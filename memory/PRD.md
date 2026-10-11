# Dr.D — PRD

## Original problem statement
"Free" = free for patients to book; doctors are listed free (single-practice or invited doctors to start, not an open paid marketplace). Dr.D — Web App. A free, queue-based doctor appointment booking platform. Patients hold a live position in a doctor's daily queue instead of rigid time slots, and Dai (AI) briefs the doctor and answers patient queries. In-app live alerts plus browser notifications (Resend email optional) — Alerts for "15 min" and "you're next" in v1. Average consult time for ETA: fixed per doctor, set by the doctor. Patients see their own position and ETA only. Daily queue cap per doctor: no cap / doctor sets max per day. Doctor accounts: open doctor sign-up. "think likewise and create a working ui friendly and beautiful web-app with good transitions, doctor can sign in, in their dashboards, staff/reception can see and send next patient, likewise, patients must have their own dashboard." (Uploaded mockup indexmain.html — brand palette navy #1E3A8A/#172554, mint #059669, Dai #34D399.)

## User choices
- Alerts: in-app live alerts + browser notifications only (no email)
- Defaults applied (skipped): doctor-set daily cap (0 = no cap), JWT email/password, Dai on Claude claude-sonnet-5-5 (Emergent key), doctor creates staff logins

## Architecture
- FastAPI (/app/backend/server.py) + MongoDB (users, queue, counters, notifications, dai_messages, login_attempts)
- React + Tailwind + shadcn + framer-motion; polling (4–5s) for live queue/alerts; SSE streaming for Dai chat
- Queue day in CLINIC_TIMEZONE (Asia/Kolkata). ETA = remaining current consult + ahead × avg_consult_min + delay (or minutes until start time)

## Personas
Patient · Doctor (owner/practice) · Reception staff

## Implemented (2026-10-11)
- Auth: register (patient/doctor), login, logout, me, refresh, brute-force lockout; seeded owner doctor (leumas.r8@gmail.com), demo staff & patient
- Patient dashboard: doctor search, join queue with reason/symptoms, live ticket (token, position, ETA, clock), check-in, leave queue, history, Dai chat (streaming)
- Alerts: "You're in", "~15 min", "You're next", "It's your turn", delay, missed — bell + sonner toast + browser Notification
- Doctor dashboard: in-consult card with Dai brief + notes, complete & call next, queue board (call/skip/recall), stats, delay ±15, walk-ins, settings (avg consult, daily cap, start time, accepting, profile), staff management
- Staff dashboard: now serving / up next, Send next patient, walk-ins, delay, queue board
- Tested: backend 21/21, frontend flows passed (iteration_1)

## Backlog
- P1: Replace placeholder owner profile ("Dr. [Your Name]", "[Your Clinic Name]", "[City]") via Settings
- P1: Invite-only doctor listing / admin approval (currently open sign-up)
- P2: Resend email alerts, QR check-in, analytics/reports, family members, doctor "summarize today" via Dai, WebSockets instead of polling
