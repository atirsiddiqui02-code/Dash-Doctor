import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BellRing, Sparkles, Users, Stethoscope, ClipboardList } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { homeFor } from "@/App";

const fade = (d = 0) => ({ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.6, delay: d, ease: [0.22, 1, 0.36, 1] } });

const MockTicket = () => (
  <motion.div initial={{ opacity: 0, rotate: 4, y: 30 }} animate={{ opacity: 1, rotate: -3, y: 0 }} transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    className="relative ticket-surface grain rounded-[28px] p-7 text-white w-full max-w-sm shadow-2xl shadow-blue-950/30">
    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-blue-200">
      <span className="flex items-center gap-2"><span className="live-dot" /> Live queue</span><span>Today</span>
    </div>
    <p className="mt-6 text-blue-200 text-sm">Your token</p>
    <p className="font-mono-num text-7xl font-extrabold leading-none mt-1">#14</p>
    <div className="mt-6 grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-blue-200">Position</p><p className="font-mono-num text-3xl font-bold">3rd</p></div>
      <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-blue-200">ETA</p><p className="font-mono-num text-3xl font-bold">~24m</p></div>
    </div>
    <div className="mt-5 h-1.5 rounded-full bg-white/15 overflow-hidden"><motion.div initial={{ width: "10%" }} animate={{ width: "72%" }} transition={{ duration: 2.4, delay: 0.8 }} className="h-full bg-[var(--dai)]" /></div>
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.4 }}
      className="absolute -bottom-6 -left-6 sm:-left-12 bg-white text-slate-900 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
      <span className="w-9 h-9 rounded-full bg-[var(--mint-soft)] grid place-items-center"><BellRing className="w-4 h-4 text-[var(--mint)]" /></span>
      <div><p className="text-sm font-semibold">About 15 min to go</p><p className="text-xs text-slate-500">Start heading to the clinic</p></div>
    </motion.div>
  </motion.div>
);

const STEPS = [
  { n: "01", t: "Pick your doctor", d: "See today's estimated wait before you join — no slot hunting." },
  { n: "02", t: "Hold your place", d: "Get a token and a live position. Your ETA updates as the queue moves." },
  { n: "03", t: "Arrive on time", d: "We alert you at ~15 minutes and again when you're next." },
];

const ROLES = [
  { icon: Users, t: "Patients", d: "Free to book. See only your own position and ETA. Ask Dai anything about your wait." },
  { icon: Stethoscope, t: "Doctors", d: "Set your average consult time and daily cap. Dai briefs you before every patient." },
  { icon: ClipboardList, t: "Reception", d: "One big button: send the next patient. Add walk-ins, skip, recall, announce delays." },
];

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return (
    <div className="bg-[hsl(var(--background))] overflow-hidden">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/70">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-10 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/login" data-testid="nav-login-link" className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-[var(--brand)] transition-colors">Sign in</Link>
            <Link to="/register" data-testid="nav-register-link" className="px-4 py-2 text-sm font-semibold rounded-full bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] btn-lift">Get started</Link>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-14 sm:pt-20 pb-24 grid lg:grid-cols-[1.15fr_1fr] gap-16 items-center">
        <div>
          <motion.p {...fade()} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mint)] bg-[var(--mint-soft)] px-3 py-1.5 rounded-full">
            <span className="live-dot" /> Free for patients
          </motion.p>
          <motion.h1 {...fade(0.08)} className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--brand-dark)] leading-[1.05]">
            Hold your place<br />in line, <span className="text-[var(--mint)]">not a time slot.</span>
          </motion.h1>
          <motion.p {...fade(0.16)} className="mt-6 text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">
            Dr.D puts you in your doctor's live daily queue. Watch your position and ETA, get pinged at 15 minutes and when you're next — and let Dai answer your questions while you wait.
          </motion.p>
          <motion.div {...fade(0.24)} className="mt-9 flex flex-wrap gap-3">
            <Link to="/register" data-testid="hero-patient-cta" className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[var(--mint)] text-white font-semibold btn-lift hover:bg-emerald-700 shadow-lg shadow-emerald-600/25">
              Join a queue <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/register?role=doctor" data-testid="hero-doctor-cta" className="inline-flex items-center gap-2 h-12 px-6 rounded-full border-2 border-[var(--brand)] text-[var(--brand)] font-semibold btn-lift hover:bg-[var(--brand)] hover:text-white">
              I'm a doctor
            </Link>
          </motion.div>
        </div>
        <div className="flex justify-center lg:justify-end pb-8"><MockTicket /></div>
      </section>

      <section className="bg-white border-y border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-20 grid md:grid-cols-[0.8fr_2fr] gap-12">
          <motion.h2 {...fade()} className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--brand-dark)]">How the queue works</motion.h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <motion.div key={s.n} {...fade(i * 0.1)} className="border-t-2 border-[var(--brand)] pt-5">
                <p className="font-mono-num text-sm text-[var(--mint)] font-bold">{s.n}</p>
                <p className="mt-2 font-display text-lg font-bold text-slate-900">{s.t}</p>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-24 grid lg:grid-cols-3 gap-6">
        {ROLES.map((r, i) => (
          <motion.div key={r.t} {...fade(i * 0.1)} className={`rounded-3xl p-8 border transition-transform duration-300 hover:-translate-y-1 ${i === 1 ? "ticket-surface text-white border-transparent lg:-translate-y-6" : "bg-white border-slate-200"}`}>
            <r.icon className={`w-7 h-7 ${i === 1 ? "text-[var(--dai)]" : "text-[var(--brand)]"}`} />
            <p className="mt-6 font-display text-2xl font-bold">{r.t}</p>
            <p className={`mt-3 text-sm leading-relaxed ${i === 1 ? "text-blue-100" : "text-slate-600"}`}>{r.d}</p>
          </motion.div>
        ))}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-24">
        <motion.div {...fade()} className="relative overflow-hidden rounded-[32px] bg-[var(--brand-dark)] grain p-10 sm:p-14 grid md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-[var(--dai)] font-semibold text-sm"><Sparkles className="w-4 h-4" /> Meet Dai</p>
            <h3 className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight max-w-xl">An AI that briefs your doctor and answers your waiting-room questions.</h3>
          </div>
          <Link to="/register" data-testid="footer-cta" className="relative z-10 inline-flex items-center gap-2 h-12 px-7 rounded-full bg-[var(--dai)] text-emerald-950 font-bold btn-lift dai-glow">
            Create free account <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500">Dr.D — free queue-based booking. Dai is an assistant, not a doctor.</footer>
    </div>
  );
}
