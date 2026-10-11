from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import json
import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, Literal

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("drd")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
TZ = ZoneInfo(os.environ["CLINIC_TIMEZONE"])
JWT_ALG = "HS256"
LLM_MODEL = ("anthropic", "claude-sonnet-5-5")

app = FastAPI()
api = APIRouter(prefix="/api")


# ---------- helpers ----------
def now():
    return datetime.now(timezone.utc)


def iso():
    return now().isoformat()


def today():
    return datetime.now(TZ).strftime("%Y-%m-%d")


def ser(doc):
    if not doc:
        return doc
    d = {k: v for k, v in doc.items() if k != "password_hash"}
    if "_id" in d:
        d["id"] = str(d.pop("_id"))
    for k, v in d.items():
        if isinstance(v, ObjectId):
            d[k] = str(v)
        elif isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


def oid(s):
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(404, "Not found")


def hash_pw(p):
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def check_pw(p, h):
    return bcrypt.checkpw(p.encode(), h.encode())


def make_token(uid, kind, ttl):
    return jwt.encode({"sub": uid, "type": kind, "exp": now() + ttl}, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


def set_auth(resp: Response, uid: str):
    access = make_token(uid, "access", timedelta(hours=8))
    refresh = make_token(uid, "refresh", timedelta(days=7))
    resp.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=8 * 3600, path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=7 * 86400, path="/")
    return access


async def current_user(request: Request):
    token = None
    h = request.headers.get("Authorization", "")
    if h.startswith("Bearer "):
        token = h[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(401, "Invalid token type")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(401, "User not found")
    return ser(user)


def require(*roles):
    async def dep(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Not allowed")
        return user
    return dep


def clinic_of(user):
    return user["id"] if user["role"] == "doctor" else user["doctor_id"]


async def get_doctor(doctor_id):
    doc = await db.users.find_one({"_id": oid(doctor_id), "role": "doctor"})
    if not doc:
        raise HTTPException(404, "Doctor not found")
    return ser(doc)


async def notify(user_id, kind, title, body):
    if not user_id:
        return
    await db.notifications.insert_one({"user_id": user_id, "type": kind, "title": title, "body": body,
                                       "read": False, "created_at": iso()})


DOCTOR_DEFAULTS = {"specialty": "General Physician", "clinic_name": "", "city": "", "bio": "",
                   "avg_consult_min": 10, "daily_cap": 30, "start_time": "10:00", "accepting": True, "delay_min": 0}


def public_doctor(d):
    keys = ["id", "name", "email", "phone"] + list(DOCTOR_DEFAULTS.keys())
    return {k: d.get(k, DOCTOR_DEFAULTS.get(k)) for k in keys}


# ---------- queue engine ----------
async def today_entries(doctor_id):
    return await db.queue.find({"doctor_id": doctor_id, "date": today()}).sort("token_no", 1).to_list(2000)


def minutes_until_start(doctor):
    try:
        hh, mm = map(int, doctor.get("start_time", "10:00").split(":"))
    except ValueError:
        return 0
    local = datetime.now(TZ)
    start = local.replace(hour=hh, minute=mm, second=0, microsecond=0)
    return max(0, (start - local).total_seconds() / 60)


def eta_for(entries, doctor, entry):
    avg = doctor.get("avg_consult_min", 10)
    delay = doctor.get("delay_min", 0)
    current = next((e for e in entries if e["status"] == "in_consult"), None)
    ahead = [e for e in entries if e["status"] == "waiting" and e["token_no"] < entry["token_no"]]
    if current:
        elapsed = (now() - datetime.fromisoformat(current["called_at"])).total_seconds() / 60
        base = max(1, avg - elapsed)
    elif any(e["status"] == "done" for e in entries):
        base = 0
    else:
        base = minutes_until_start(doctor)
    return {"position": len(ahead) + 1, "ahead": len(ahead), "eta_min": round(base + len(ahead) * avg + delay)}


def new_join_wait(entries, doctor):
    fake = {"token_no": 10 ** 9}
    return eta_for(entries, doctor, fake)


async def dispatch_alerts(doctor_id):
    doctor = await get_doctor(doctor_id)
    entries = await today_entries(doctor_id)
    for e in entries:
        if e["status"] != "waiting" or not e.get("patient_id"):
            continue
        info = eta_for(entries, doctor, e)
        sets = {}
        if info["ahead"] == 0 and not e.get("alert_next"):
            await notify(e["patient_id"], "next", "You're next!",
                         f"Token #{e['token_no']} — please be ready, {doctor['name']} will see you next.")
            sets = {"alert_next": True, "alert_15": True}
        elif info["eta_min"] <= 15 and not e.get("alert_15"):
            await notify(e["patient_id"], "15min", "About 15 minutes to go",
                         f"Token #{e['token_no']} — your turn with {doctor['name']} is ~{info['eta_min']} min away.")
            sets = {"alert_15": True}
        if sets:
            await db.queue.update_one({"_id": e["_id"]}, {"$set": sets})


async def next_token(doctor_id):
    res = await db.counters.find_one_and_update({"_id": f"{doctor_id}:{today()}"}, {"$inc": {"seq": 1}},
                                                upsert=True, return_document=True)
    return res["seq"]


# ---------- models ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=6)
    role: Literal["patient", "doctor"]
    phone: Optional[str] = ""
    specialty: Optional[str] = None
    clinic_name: Optional[str] = ""
    city: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


class JoinIn(BaseModel):
    doctor_id: str
    reason: str = Field(min_length=2)
    symptoms: Optional[str] = ""


class WalkinIn(BaseModel):
    name: str = Field(min_length=2)
    phone: Optional[str] = ""
    reason: str = Field(min_length=2)
    symptoms: Optional[str] = ""


class SettingsIn(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    clinic_name: Optional[str] = None
    city: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    avg_consult_min: Optional[int] = Field(None, ge=1, le=180)
    daily_cap: Optional[int] = Field(None, ge=0, le=1000)
    start_time: Optional[str] = None
    accepting: Optional[bool] = None


class DelayIn(BaseModel):
    minutes: int = Field(ge=-180, le=180)


class NotesIn(BaseModel):
    notes: Optional[str] = ""


class StaffIn(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=6)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


# ---------- auth ----------
def auth_payload(user_doc, token):
    u = ser(user_doc)
    return {"user": u, "token": token}


@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    doc = {"name": body.name.strip(), "email": email, "password_hash": hash_pw(body.password), "role": body.role,
           "phone": body.phone or "", "created_at": iso()}
    if body.role == "doctor":
        doc.update(DOCTOR_DEFAULTS)
        doc.update({"specialty": body.specialty or DOCTOR_DEFAULTS["specialty"],
                    "clinic_name": body.clinic_name or "", "city": body.city or ""})
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    token = set_auth(response, str(res.inserted_id))
    return auth_payload(doc, token)


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{request.client.host if request.client else 'x'}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and att.get("locked_until") and datetime.fromisoformat(att["locked_until"]) > now():
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not check_pw(body.password, user["password_hash"]):
        cnt = (att or {}).get("count", 0) + 1
        await db.login_attempts.update_one({"identifier": ident}, {"$set": {
            "count": cnt, "locked_until": (now() + timedelta(minutes=15)).isoformat() if cnt >= 5 else None}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_one({"identifier": ident})
    token = set_auth(response, str(user["_id"]))
    return auth_payload(user, token)


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", secure=True, samesite="none")
    response.delete_cookie("refresh_token", path="/", secure=True, samesite="none")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


@api.patch("/auth/me")
async def update_me(body: ProfileIn, user=Depends(current_user)):
    sets = {k: v for k, v in body.model_dump().items() if v is not None}
    if sets:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": sets})
    return ser(await db.users.find_one({"_id": ObjectId(user["id"])}))


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid token type")
    return {"token": set_auth(response, payload["sub"])}


# ---------- public doctors ----------
@api.get("/doctors")
async def list_doctors(q: Optional[str] = None):
    filt = {"role": "doctor"}
    if q:
        rx = {"$regex": q, "$options": "i"}
        filt["$or"] = [{"name": rx}, {"specialty": rx}, {"clinic_name": rx}, {"city": rx}]
    docs = await db.users.find(filt).sort("name", 1).to_list(200)
    out = []
    for d in docs:
        d = ser(d)
        entries = await today_entries(d["id"])
        booked = len([e for e in entries if e["status"] != "cancelled"])
        cap = d.get("daily_cap", 0)
        out.append({**public_doctor(d), "booked_today": booked,
                    "spots_left": None if not cap else max(0, cap - booked),
                    "est_wait_min": new_join_wait(entries, d)["eta_min"]})
    return out


# ---------- patient ----------
async def entry_view(e, doctor=None, entries=None):
    doctor = doctor or await get_doctor(e["doctor_id"])
    v = ser(e)
    v["doctor"] = {"id": doctor["id"], "name": doctor["name"], "specialty": doctor.get("specialty"),
                   "clinic_name": doctor.get("clinic_name"), "avg_consult_min": doctor.get("avg_consult_min")}
    if e["status"] == "waiting":
        entries = entries if entries is not None else await today_entries(e["doctor_id"])
        v.update(eta_for(entries, doctor, e))
    return v


@api.post("/queue/join")
async def join_queue(body: JoinIn, user=Depends(require("patient"))):
    doctor = await get_doctor(body.doctor_id)
    if not doctor.get("accepting", True):
        raise HTTPException(400, "This doctor is not accepting queue bookings right now")
    entries = await today_entries(doctor["id"])
    active = [e for e in entries if e["status"] != "cancelled"]
    cap = doctor.get("daily_cap", 0)
    if cap and len(active) >= cap:
        raise HTTPException(400, "Today's queue is full for this doctor")
    if any(e.get("patient_id") == user["id"] and e["status"] in ("waiting", "in_consult") for e in entries):
        raise HTTPException(400, "You're already in this doctor's queue today")
    doc = {"doctor_id": doctor["id"], "patient_id": user["id"], "patient_name": user["name"],
           "patient_phone": user.get("phone", ""), "date": today(), "token_no": await next_token(doctor["id"]),
           "status": "waiting", "reason": body.reason.strip(), "symptoms": (body.symptoms or "").strip(),
           "checked_in": False, "walk_in": False, "created_at": iso()}
    res = await db.queue.insert_one(doc)
    doc["_id"] = res.inserted_id
    await notify(user["id"], "joined", f"You're in! Token #{doc['token_no']}",
                 f"You joined {doctor['name']}'s queue for today. We'll alert you at 15 min and when you're next.")
    await dispatch_alerts(doctor["id"])
    return await entry_view(doc, doctor)


@api.get("/patient/queue")
async def my_queue(user=Depends(require("patient"))):
    entries = await db.queue.find({"patient_id": user["id"], "date": today(),
                                   "status": {"$in": ["waiting", "in_consult"]}}).sort("created_at", 1).to_list(50)
    out = []
    for e in entries:
        await dispatch_alerts(e["doctor_id"])
        fresh = await db.queue.find_one({"_id": e["_id"]})
        out.append(await entry_view(fresh))
    return out


@api.get("/patient/history")
async def my_history(user=Depends(require("patient"))):
    entries = await db.queue.find({"patient_id": user["id"], "status": {"$in": ["done", "cancelled", "skipped"]}}
                                  ).sort("created_at", -1).to_list(100)
    names = {}
    out = []
    for e in entries:
        if e["doctor_id"] not in names:
            d = await db.users.find_one({"_id": ObjectId(e["doctor_id"])})
            names[e["doctor_id"]] = d["name"] if d else "Doctor"
        v = ser(e)
        v.pop("dai_brief", None)
        v["doctor_name"] = names[e["doctor_id"]]
        out.append(v)
    return out


async def own_entry(entry_id, user):
    e = await db.queue.find_one({"_id": oid(entry_id), "patient_id": user["id"]})
    if not e:
        raise HTTPException(404, "Queue entry not found")
    return e


@api.post("/queue/{entry_id}/cancel")
async def cancel_entry(entry_id: str, user=Depends(require("patient"))):
    e = await own_entry(entry_id, user)
    if e["status"] != "waiting":
        raise HTTPException(400, "Only waiting entries can be cancelled")
    await db.queue.update_one({"_id": e["_id"]}, {"$set": {"status": "cancelled", "cancelled_at": iso()}})
    await dispatch_alerts(e["doctor_id"])
    return {"ok": True}


@api.post("/queue/{entry_id}/checkin")
async def checkin_entry(entry_id: str, user=Depends(require("patient"))):
    e = await own_entry(entry_id, user)
    if e["status"] != "waiting":
        raise HTTPException(400, "Only waiting entries can check in")
    await db.queue.update_one({"_id": e["_id"]}, {"$set": {"checked_in": True, "checked_in_at": iso()}})
    return {"ok": True}


# ---------- clinic (doctor + staff) ----------
@api.get("/clinic/queue")
async def clinic_queue(user=Depends(require("doctor", "staff"))):
    did = clinic_of(user)
    doctor = await get_doctor(did)
    entries = await today_entries(did)
    items = []
    for e in entries:
        v = ser(e)
        if e["status"] == "waiting":
            v.update(eta_for(entries, doctor, e))
        items.append(v)
    count = lambda s: len([e for e in entries if e["status"] == s])
    return {"doctor": public_doctor(doctor), "date": today(), "entries": items,
            "stats": {"waiting": count("waiting"), "in_consult": count("in_consult"), "done": count("done"),
                      "skipped": count("skipped"), "cancelled": count("cancelled"),
                      "total": len([e for e in entries if e["status"] != "cancelled"])}}


async def clinic_entry(entry_id, user):
    e = await db.queue.find_one({"_id": oid(entry_id), "doctor_id": clinic_of(user), "date": today()})
    if not e:
        raise HTTPException(404, "Queue entry not found")
    return e


async def finish_current(did, notes=None):
    sets = {"status": "done", "done_at": iso()}
    if notes:
        sets["notes"] = notes
    await db.queue.update_many({"doctor_id": did, "date": today(), "status": "in_consult"}, {"$set": sets})


async def call_entry(e, doctor):
    await db.queue.update_one({"_id": e["_id"]}, {"$set": {"status": "in_consult", "called_at": iso(),
                                                           "alert_next": True, "alert_15": True}})
    await notify(e.get("patient_id"), "called", "It's your turn",
                 f"Token #{e['token_no']} — please proceed to {doctor['name']}'s room.")


@api.post("/clinic/next")
async def call_next(body: NotesIn = NotesIn(), user=Depends(require("doctor", "staff"))):
    did = clinic_of(user)
    doctor = await get_doctor(did)
    await finish_current(did, body.notes)
    nxt = await db.queue.find_one({"doctor_id": did, "date": today(), "status": "waiting"}, sort=[("token_no", 1)])
    if nxt:
        await call_entry(nxt, doctor)
        nxt = await db.queue.find_one({"_id": nxt["_id"]})
    await dispatch_alerts(did)
    return {"called": ser(nxt) if nxt else None}


@api.post("/clinic/queue/{entry_id}/complete")
async def complete_entry(entry_id: str, body: NotesIn, user=Depends(require("doctor", "staff"))):
    e = await clinic_entry(entry_id, user)
    await db.queue.update_one({"_id": e["_id"]}, {"$set": {"status": "done", "done_at": iso(), "notes": body.notes or ""}})
    await dispatch_alerts(e["doctor_id"])
    return {"ok": True}


@api.post("/clinic/queue/{entry_id}/skip")
async def skip_entry(entry_id: str, user=Depends(require("doctor", "staff"))):
    e = await clinic_entry(entry_id, user)
    if e["status"] not in ("waiting", "in_consult"):
        raise HTTPException(400, "Cannot skip this entry")
    await db.queue.update_one({"_id": e["_id"]}, {"$set": {"status": "skipped", "skipped_at": iso()}})
    await notify(e.get("patient_id"), "skipped", "You were marked as missed",
                 f"Token #{e['token_no']} — please let reception know when you arrive to be recalled.")
    await dispatch_alerts(e["doctor_id"])
    return {"ok": True}


@api.post("/clinic/queue/{entry_id}/recall")
async def recall_entry(entry_id: str, user=Depends(require("doctor", "staff"))):
    e = await clinic_entry(entry_id, user)
    if e["status"] != "skipped":
        raise HTTPException(400, "Only skipped entries can be recalled")
    await db.queue.update_one({"_id": e["_id"]}, {"$set": {"status": "waiting", "alert_next": False, "alert_15": False}})
    await dispatch_alerts(e["doctor_id"])
    return {"ok": True}


@api.post("/clinic/queue/{entry_id}/call")
async def call_specific(entry_id: str, user=Depends(require("doctor", "staff"))):
    e = await clinic_entry(entry_id, user)
    if e["status"] != "waiting":
        raise HTTPException(400, "Only waiting entries can be called")
    doctor = await get_doctor(e["doctor_id"])
    await finish_current(e["doctor_id"])
    await call_entry(e, doctor)
    await dispatch_alerts(e["doctor_id"])
    return {"ok": True}


@api.post("/clinic/walkin")
async def add_walkin(body: WalkinIn, user=Depends(require("doctor", "staff"))):
    did = clinic_of(user)
    doctor = await get_doctor(did)
    entries = await today_entries(did)
    cap = doctor.get("daily_cap", 0)
    if cap and len([e for e in entries if e["status"] != "cancelled"]) >= cap:
        raise HTTPException(400, "Today's queue is full (daily cap reached)")
    doc = {"doctor_id": did, "patient_id": None, "patient_name": body.name.strip(), "patient_phone": body.phone or "",
           "date": today(), "token_no": await next_token(did), "status": "waiting", "reason": body.reason.strip(),
           "symptoms": (body.symptoms or "").strip(), "checked_in": True, "walk_in": True, "created_at": iso()}
    res = await db.queue.insert_one(doc)
    doc["_id"] = res.inserted_id
    return ser(doc)


@api.post("/clinic/delay")
async def set_delay(body: DelayIn, user=Depends(require("doctor", "staff"))):
    did = clinic_of(user)
    doctor = await get_doctor(did)
    new_delay = max(0, doctor.get("delay_min", 0) + body.minutes)
    await db.users.update_one({"_id": ObjectId(did)}, {"$set": {"delay_min": new_delay}})
    if body.minutes > 0:
        for e in await today_entries(did):
            if e["status"] == "waiting":
                await notify(e.get("patient_id"), "delay", f"Running ~{body.minutes} min late",
                             f"{doctor['name']} is running behind. Your ETA has been updated.")
    await dispatch_alerts(did)
    return {"delay_min": new_delay}


@api.get("/clinic/settings")
async def get_settings(user=Depends(require("doctor", "staff"))):
    return public_doctor(await get_doctor(clinic_of(user)))


@api.patch("/clinic/settings")
async def update_settings(body: SettingsIn, user=Depends(require("doctor"))):
    sets = {k: v for k, v in body.model_dump().items() if v is not None}
    if "start_time" in sets:
        try:
            datetime.strptime(sets["start_time"], "%H:%M")
        except ValueError:
            raise HTTPException(400, "start_time must be HH:MM")
    if sets:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": sets})
    await dispatch_alerts(user["id"])
    return public_doctor(await get_doctor(user["id"]))


@api.get("/clinic/staff")
async def list_staff(user=Depends(require("doctor"))):
    return [ser(s) for s in await db.users.find({"role": "staff", "doctor_id": user["id"]}).to_list(100)]


@api.post("/clinic/staff")
async def add_staff(body: StaffIn, user=Depends(require("doctor"))):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    doc = {"name": body.name.strip(), "email": email, "password_hash": hash_pw(body.password), "role": "staff",
           "doctor_id": user["id"], "phone": "", "created_at": iso()}
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return ser(doc)


@api.delete("/clinic/staff/{staff_id}")
async def remove_staff(staff_id: str, user=Depends(require("doctor"))):
    res = await db.users.delete_one({"_id": oid(staff_id), "role": "staff", "doctor_id": user["id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Staff not found")
    return {"ok": True}


# ---------- notifications ----------
@api.get("/notifications")
async def list_notifications(user=Depends(current_user)):
    docs = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).to_list(40)
    return [ser(d) for d in docs]


@api.post("/notifications/read-all")
async def read_all(user=Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- Dai (AI) ----------
def dai_chat(session_id, system):
    return LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=session_id,
                   system_message=system).with_model(*LLM_MODEL)


@api.post("/dai/brief/{entry_id}")
async def dai_brief(entry_id: str, force: bool = False, user=Depends(require("doctor", "staff"))):
    e = await clinic_entry(entry_id, user)
    if e.get("dai_brief") and not force:
        return {"brief": e["dai_brief"]}
    past = []
    if e.get("patient_id"):
        past = await db.queue.find({"patient_id": e["patient_id"], "doctor_id": e["doctor_id"], "status": "done",
                                    "_id": {"$ne": e["_id"]}}).sort("created_at", -1).to_list(5)
    history = "\n".join(f"- {p['date']}: reason '{p.get('reason', '')}', notes: {p.get('notes') or 'none'}" for p in past) or "No previous visits on record."
    prompt = (f"Patient: {e['patient_name']} (token #{e['token_no']}, {'walk-in' if e.get('walk_in') else 'online queue'})\n"
              f"Reason for visit: {e.get('reason', '')}\nReported symptoms: {e.get('symptoms') or 'not provided'}\n"
              f"Previous visits with this doctor:\n{history}")
    system = ("You are Dai, a clinical assistant that briefs a doctor before a consult. Write a concise brief in plain text "
              "with 3 short labelled sections: 'Summary', 'From history', 'Suggested questions' (max 3 bullet questions). "
              "Under 120 words. Do not diagnose or prescribe; only summarise what the patient reported.")
    text = ""
    async for ev in dai_chat(f"brief-{entry_id}", system).stream_message(UserMessage(text=prompt)):
        if isinstance(ev, TextDelta):
            text += ev.content
        elif isinstance(ev, StreamDone):
            break
    await db.queue.update_one({"_id": e["_id"]}, {"$set": {"dai_brief": text.strip()}})
    return {"brief": text.strip()}


@api.get("/dai/history")
async def dai_history(user=Depends(require("patient"))):
    docs = await db.dai_messages.find({"user_id": user["id"]}).sort("created_at", -1).to_list(30)
    return [ser(d) for d in reversed(docs)]


@api.post("/dai/chat")
async def dai_chat_endpoint(body: ChatIn, user=Depends(require("patient"))):
    active = await db.queue.find({"patient_id": user["id"], "date": today(),
                                  "status": {"$in": ["waiting", "in_consult"]}}).to_list(10)
    ctx = []
    for e in active:
        v = await entry_view(e)
        if e["status"] == "in_consult":
            ctx.append(f"- With {v['doctor']['name']}: token #{e['token_no']}, currently IN CONSULT now.")
        else:
            ctx.append(f"- With {v['doctor']['name']} ({v['doctor']['specialty']}): token #{e['token_no']}, "
                       f"position {v['position']}, {v['ahead']} ahead, ETA ~{v['eta_min']} min, checked in: {e.get('checked_in')}.")
    doctors = await db.users.find({"role": "doctor"}).to_list(50)
    dl = "\n".join(f"- {d['name']} — {d.get('specialty', '')}, starts {d.get('start_time', '10:00')}, "
                   f"avg consult {d.get('avg_consult_min', 10)} min, {'accepting' if d.get('accepting', True) else 'not accepting'} today"
                   for d in doctors)
    hist = await db.dai_messages.find({"user_id": user["id"]}).sort("created_at", -1).to_list(10)
    convo = "\n".join(f"{m['role']}: {m['content']}" for m in reversed(hist))
    system = ("You are Dai, the friendly assistant of Dr.D, a free queue-based clinic booking app. Patients hold a live "
              "position in a doctor's daily queue instead of time slots. Answer briefly (under 90 words), warmly and clearly. "
              "You may explain queue position/ETA, how to join, check in or cancel, and general wellness tips. Never diagnose "
              "or prescribe. For emergencies tell them to call local emergency services immediately. Only share the "
              "patient's own queue info.\n\n"
              f"Patient name: {user['name']}\nPatient's queue today:\n{chr(10).join(ctx) or '- Not in any queue today.'}\n\n"
              f"Doctors on Dr.D:\n{dl}")
    prompt = (f"Recent conversation:\n{convo}\n\nuser: {body.message}" if convo else body.message)
    await db.dai_messages.insert_one({"user_id": user["id"], "role": "user", "content": body.message, "created_at": iso()})

    async def gen():
        full = ""
        try:
            async for ev in dai_chat(f"patient-{user['id']}", system).stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as ex:
            logger.exception("Dai chat failed")
            full = full or "Sorry, I couldn't respond right now. Please try again in a moment."
            yield f"data: {json.dumps({'delta': full, 'error': str(ex)[:100]})}\n\n"
        await db.dai_messages.insert_one({"user_id": user["id"], "role": "assistant", "content": full, "created_at": iso()})
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api.get("/")
async def root():
    return {"message": "Dr.D API"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ["FRONTEND_URL"], "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- startup ----------
async def seed_user(email, password, role, name, extra=None):
    existing = await db.users.find_one({"email": email})
    if not existing:
        doc = {"name": name, "email": email, "password_hash": hash_pw(password), "role": role, "phone": "",
               "created_at": iso(), **(extra or {})}
        res = await db.users.insert_one(doc)
        return str(res.inserted_id)
    if not check_pw(password, existing["password_hash"]):
        await db.users.update_one({"_id": existing["_id"]}, {"$set": {"password_hash": hash_pw(password)}})
    return str(existing["_id"])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.queue.create_index([("doctor_id", 1), ("date", 1), ("token_no", 1)])
    await db.queue.create_index([("patient_id", 1), ("date", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    owner_id = await seed_user(os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "doctor",
                               "Dr. [Your Name]", {**DOCTOR_DEFAULTS, "is_owner": True,
                                                   "clinic_name": "[Your Clinic Name]", "city": "[City]"})
    await seed_user("reception@drd.app", "Staff@123", "staff", "Reception Desk", {"doctor_id": owner_id})
    await seed_user("patient@drd.app", "Patient@123", "patient", "Demo Patient")


@app.on_event("shutdown")
async def shutdown():
    client.close()
