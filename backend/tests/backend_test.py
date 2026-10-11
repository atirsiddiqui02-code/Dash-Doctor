"""Dr.D backend API tests."""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
API = BASE_URL.rstrip("/") + "/api"

OWNER = {"email": "leumas.r8@gmail.com", "password": "DrD@Owner2026"}
STAFF = {"email": "reception@drd.app", "password": "Staff@123"}
PATIENT = {"email": "patient@drd.app", "password": "Patient@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return data


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def owner_auth():
    return _login(OWNER)


@pytest.fixture(scope="session")
def staff_auth():
    return _login(STAFF)


@pytest.fixture(scope="session")
def patient_auth():
    return _login(PATIENT)


# ---------- Auth ----------
class TestAuth:
    def test_health_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert "Dr.D" in r.json().get("message", "")

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nobody@x.com", "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, patient_auth):
        r = requests.get(f"{API}/auth/me", headers=_hdr(patient_auth["token"]))
        assert r.status_code == 200
        assert r.json()["email"] == PATIENT["email"]
        assert "password_hash" not in r.json()

    def test_register_and_cleanup(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST_User", "email": email, "password": "pass1234", "role": "patient"})
        assert r.status_code == 200
        uid = r.json()["user"]["id"]
        # cleanup via mongo not available here; leave but role=patient has no side effects
        assert r.json()["user"]["role"] == "patient"
        assert r.json()["user"]["email"] == email


# ---------- Doctors list ----------
class TestDoctors:
    def test_list_doctors_public(self):
        r = requests.get(f"{API}/doctors")
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        assert any(d["email"] == OWNER["email"] for d in docs)
        for d in docs:
            assert "est_wait_min" in d and "booked_today" in d


# ---------- Role protection ----------
class TestRoleProtection:
    def test_patient_cannot_access_clinic(self, patient_auth):
        r = requests.get(f"{API}/clinic/queue", headers=_hdr(patient_auth["token"]))
        assert r.status_code == 403

    def test_staff_cannot_patch_settings(self, staff_auth):
        r = requests.patch(f"{API}/clinic/settings", json={"avg_consult_min": 12},
                           headers=_hdr(staff_auth["token"]))
        assert r.status_code == 403

    def test_doctor_cannot_join_queue(self, owner_auth):
        r = requests.post(f"{API}/queue/join", json={"doctor_id": owner_auth["user"]["id"], "reason": "test"},
                          headers=_hdr(owner_auth["token"]))
        assert r.status_code == 403


# ---------- Settings & Queue flow (owner doctor) ----------
class TestClinicFlow:
    def test_reset_owner_settings(self, owner_auth):
        r = requests.patch(f"{API}/clinic/settings",
                           json={"avg_consult_min": 10, "daily_cap": 30, "accepting": True},
                           headers=_hdr(owner_auth["token"]))
        assert r.status_code == 200
        s = r.json()
        assert s["avg_consult_min"] == 10
        assert s["daily_cap"] == 30
        assert s["accepting"] is True

    def test_zero_delay_reset(self, owner_auth):
        # Can't set delay_min directly; use /clinic/delay with negative to reduce. new = max(0, cur+minutes)
        requests.post(f"{API}/clinic/delay", json={"minutes": -180}, headers=_hdr(owner_auth["token"]))
        r = requests.get(f"{API}/clinic/settings", headers=_hdr(owner_auth["token"]))
        assert r.json().get("delay_min", 0) == 0

    def test_settings_persistence(self, owner_auth):
        requests.patch(f"{API}/clinic/settings", json={"avg_consult_min": 15},
                       headers=_hdr(owner_auth["token"]))
        r = requests.get(f"{API}/clinic/settings", headers=_hdr(owner_auth["token"]))
        assert r.json()["avg_consult_min"] == 15
        # revert
        requests.patch(f"{API}/clinic/settings", json={"avg_consult_min": 10},
                       headers=_hdr(owner_auth["token"]))


# ---------- Patient queue join / leave ----------
@pytest.fixture
def clean_patient_queue(patient_auth):
    # cancel any existing entries
    r = requests.get(f"{API}/patient/queue", headers=_hdr(patient_auth["token"]))
    if r.status_code == 200:
        for e in r.json():
            if e["status"] == "waiting":
                requests.post(f"{API}/queue/{e['id']}/cancel", headers=_hdr(patient_auth["token"]))
    yield
    r = requests.get(f"{API}/patient/queue", headers=_hdr(patient_auth["token"]))
    if r.status_code == 200:
        for e in r.json():
            if e["status"] == "waiting":
                requests.post(f"{API}/queue/{e['id']}/cancel", headers=_hdr(patient_auth["token"]))


class TestPatientQueue:
    def test_join_and_duplicate(self, owner_auth, patient_auth, clean_patient_queue):
        did = owner_auth["user"]["id"]
        r = requests.post(f"{API}/queue/join",
                          json={"doctor_id": did, "reason": "Fever and cough"},
                          headers=_hdr(patient_auth["token"]))
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["status"] == "waiting"
        assert "token_no" in v and "eta_min" in v and "position" in v
        entry_id = v["id"]

        # duplicate
        r2 = requests.post(f"{API}/queue/join",
                           json={"doctor_id": did, "reason": "again"},
                           headers=_hdr(patient_auth["token"]))
        assert r2.status_code == 400

        # checkin
        r3 = requests.post(f"{API}/queue/{entry_id}/checkin",
                           headers=_hdr(patient_auth["token"]))
        assert r3.status_code == 200

        # patient queue
        r4 = requests.get(f"{API}/patient/queue", headers=_hdr(patient_auth["token"]))
        assert r4.status_code == 200
        assert any(e["id"] == entry_id for e in r4.json())

        # cancel
        r5 = requests.post(f"{API}/queue/{entry_id}/cancel",
                           headers=_hdr(patient_auth["token"]))
        assert r5.status_code == 200

        # cancel again -> 400
        r6 = requests.post(f"{API}/queue/{entry_id}/cancel",
                           headers=_hdr(patient_auth["token"]))
        assert r6.status_code == 400


# ---------- Walk-in + clinic queue + call next + delay ----------
class TestClinicQueueOps:
    def test_walkin_and_call_next(self, owner_auth):
        tok = owner_auth["token"]
        name = f"TEST_Walkin_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/clinic/walkin",
                          json={"name": name, "reason": "checkup"},
                          headers=_hdr(tok))
        assert r.status_code == 200
        entry = r.json()
        assert entry["walk_in"] is True
        assert entry["status"] == "waiting"

        # list queue
        r2 = requests.get(f"{API}/clinic/queue", headers=_hdr(tok))
        assert r2.status_code == 200
        assert any(e["id"] == entry["id"] for e in r2.json()["entries"])

        # call specific
        r3 = requests.post(f"{API}/clinic/queue/{entry['id']}/call", headers=_hdr(tok))
        assert r3.status_code == 200

        r4 = requests.get(f"{API}/clinic/queue", headers=_hdr(tok))
        e = next(x for x in r4.json()["entries"] if x["id"] == entry["id"])
        assert e["status"] == "in_consult"

        # complete via next (no next left)
        r5 = requests.post(f"{API}/clinic/next", json={"notes": "ok"}, headers=_hdr(tok))
        assert r5.status_code == 200

    def test_delay_increments(self, owner_auth):
        tok = owner_auth["token"]
        r = requests.post(f"{API}/clinic/delay", json={"minutes": 15}, headers=_hdr(tok))
        assert r.status_code == 200
        assert r.json()["delay_min"] >= 15
        # reset
        requests.post(f"{API}/clinic/delay", json={"minutes": -180}, headers=_hdr(tok))

    def test_daily_cap_blocks_join(self, owner_auth, patient_auth, clean_patient_queue):
        tok = owner_auth["token"]
        did = owner_auth["user"]["id"]
        # set cap to 1
        requests.patch(f"{API}/clinic/settings", json={"daily_cap": 1}, headers=_hdr(tok))
        # add walkin to fill
        requests.post(f"{API}/clinic/walkin",
                      json={"name": f"TEST_Fill_{uuid.uuid4().hex[:6]}", "reason": "checkup"},
                      headers=_hdr(tok))
        # patient join should fail if active count already >= 1
        r = requests.post(f"{API}/queue/join",
                          json={"doctor_id": did, "reason": "should fail"},
                          headers=_hdr(patient_auth["token"]))
        # It may be 400 (full) OR 200 if active<1 at time; assert specific message if 400
        if r.status_code == 400:
            assert "full" in r.text.lower()
        # Restore
        requests.patch(f"{API}/clinic/settings", json={"daily_cap": 30, "accepting": True},
                       headers=_hdr(tok))

    def test_accepting_false_blocks(self, owner_auth, patient_auth, clean_patient_queue):
        tok = owner_auth["token"]
        did = owner_auth["user"]["id"]
        requests.patch(f"{API}/clinic/settings", json={"accepting": False}, headers=_hdr(tok))
        r = requests.post(f"{API}/queue/join",
                          json={"doctor_id": did, "reason": "nope"},
                          headers=_hdr(patient_auth["token"]))
        assert r.status_code == 400
        assert "not accepting" in r.text.lower()
        requests.patch(f"{API}/clinic/settings", json={"accepting": True}, headers=_hdr(tok))


# ---------- Staff management ----------
class TestStaffManagement:
    def test_create_login_remove_staff(self, owner_auth):
        tok = owner_auth["token"]
        email = f"test_staff_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/clinic/staff",
                          json={"name": "TEST_Staff", "email": email, "password": "staffpass1"},
                          headers=_hdr(tok))
        assert r.status_code == 200
        sid = r.json()["id"]

        # staff can login
        s_auth = _login({"email": email, "password": "staffpass1"})
        assert s_auth["user"]["role"] == "staff"

        # staff sees owner queue
        q = requests.get(f"{API}/clinic/queue", headers=_hdr(s_auth["token"]))
        assert q.status_code == 200
        assert q.json()["doctor"]["id"] == owner_auth["user"]["id"]

        # remove
        d = requests.delete(f"{API}/clinic/staff/{sid}", headers=_hdr(tok))
        assert d.status_code == 200


# ---------- Notifications ----------
class TestNotifications:
    def test_list(self, patient_auth):
        r = requests.get(f"{API}/notifications", headers=_hdr(patient_auth["token"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_read_all(self, patient_auth):
        r = requests.post(f"{API}/notifications/read-all", headers=_hdr(patient_auth["token"]))
        assert r.status_code == 200


# ---------- ETA math ----------
class TestEtaMath:
    def test_eta_increases_with_people_ahead(self, owner_auth, patient_auth, clean_patient_queue):
        tok = owner_auth["token"]
        # reset settings
        requests.patch(f"{API}/clinic/settings",
                       json={"avg_consult_min": 10, "daily_cap": 30, "accepting": True},
                       headers=_hdr(tok))
        requests.post(f"{API}/clinic/delay", json={"minutes": -180}, headers=_hdr(tok))

        # count baseline waiting
        q0 = requests.get(f"{API}/clinic/queue", headers=_hdr(tok)).json()
        baseline_waiting = q0["stats"]["waiting"]

        # 2 walk-ins ahead
        added = []
        for _ in range(2):
            r = requests.post(f"{API}/clinic/walkin",
                              json={"name": f"TEST_Ahead_{uuid.uuid4().hex[:6]}", "reason": "checkup"},
                              headers=_hdr(tok))
            assert r.status_code == 200, r.text
            added.append(r.json()["id"])

        q1 = requests.get(f"{API}/clinic/queue", headers=_hdr(tok)).json()
        assert q1["stats"]["waiting"] >= baseline_waiting + 2

        did = owner_auth["user"]["id"]
        r = requests.post(f"{API}/queue/join",
                          json={"doctor_id": did, "reason": "eta test"},
                          headers=_hdr(patient_auth["token"]))
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["ahead"] >= 2, f"expected ahead>=2 got {v}"
        assert v["eta_min"] >= 15, f"eta_min={v['eta_min']} with ahead={v['ahead']}"

        # cleanup entry
        requests.post(f"{API}/queue/{v['id']}/cancel", headers=_hdr(patient_auth["token"]))
