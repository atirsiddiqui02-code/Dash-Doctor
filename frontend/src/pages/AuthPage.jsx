import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User, Stethoscope, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";
import { homeFor } from "@/App";

const Field = ({ id, label, ...p }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-slate-700">{label}</Label>
    <Input id={id} data-testid={`auth-${id}-input`} className="h-11 rounded-xl bg-white" {...p} />
  </div>
);

const RolePick = ({ role, setRole }) => (
  <div className="grid grid-cols-2 gap-3">
    {[["patient", "Patient", User], ["doctor", "Doctor", Stethoscope]].map(([k, l, Icon]) => (
      <button type="button" key={k} data-testid={`role-select-${k}-button`} onClick={() => setRole(k)}
        className={`flex items-center gap-2.5 p-3.5 rounded-xl border-2 text-left transition-colors ${role === k ? "border-[var(--brand)] bg-blue-50 text-[var(--brand)]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
        <Icon className="w-5 h-5" /><span className="font-semibold text-sm">{l}</span>
      </button>
    ))}
  </div>
);

export default function AuthPage({ mode }) {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get("role") === "doctor" ? "doctor" : "patient");
  const [f, setF] = useState({ name: "", email: "", password: "", phone: "", specialty: "", clinic_name: "", city: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isReg = mode === "register";
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const u = isReg ? await register({ ...f, role }) : await login(f.email, f.password);
      nav(homeFor(u.role));
    } catch (ex) { setErr(errMsg(ex)); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden lg:flex relative ticket-surface grain p-12 flex-col justify-between overflow-hidden">
        <Logo light />
        <div>
          <p className="font-mono-num text-[9rem] leading-none font-extrabold text-white/10 select-none">#07</p>
          <h2 className="text-4xl font-extrabold text-white tracking-tight max-w-md">Your place in line, live — wherever you are.</h2>
          <p className="mt-4 text-blue-200 max-w-md">Doctors, reception and patients all on one calm, real-time queue.</p>
        </div>
        <p className="text-xs text-blue-300">Free for patients. Always.</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div key={mode} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--brand-dark)]">{isReg ? "Create your account" : "Welcome back"}</h1>
          <p className="text-slate-500 mt-2 text-sm">{isReg ? "Patients book free. Doctors get listed free." : "Sign in as a patient, doctor or reception staff."}</p>
          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="auth-form">
            {isReg && <RolePick role={role} setRole={setRole} />}
            {isReg && <Field id="name" label={role === "doctor" ? "Full name (e.g. Dr. A. Rao)" : "Full name"} value={f.name} onChange={on("name")} required />}
            <Field id="email" label="Email" type="email" value={f.email} onChange={on("email")} required />
            <Field id="password" label="Password" type="password" value={f.password} onChange={on("password")} required minLength={isReg ? 6 : 1} />
            {isReg && <Field id="phone" label="Phone (optional)" value={f.phone} onChange={on("phone")} />}
            <AnimatePresence>
              {isReg && role === "doctor" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                  <Field id="specialty" label="Specialty" placeholder="General Physician" value={f.specialty} onChange={on("specialty")} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="clinic_name" label="Clinic name" value={f.clinic_name} onChange={on("clinic_name")} />
                    <Field id="city" label="City" value={f.city} onChange={on("city")} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {err && <p data-testid="auth-error-message" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
            <button data-testid="auth-submit-button" disabled={busy} className="w-full h-12 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-semibold btn-lift flex items-center justify-center gap-2 disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} {isReg ? "Create account" : "Sign in"}
            </button>
          </form>
          <p className="mt-6 text-sm text-slate-500 text-center">
            {isReg ? "Already have an account? " : "New to Dr.D? "}
            <Link data-testid="auth-switch-link" to={isReg ? "/login" : "/register"} className="font-semibold text-[var(--brand)] hover:underline">{isReg ? "Sign in" : "Create an account"}</Link>
          </p>
          {!isReg && <p className="mt-3 text-xs text-slate-400 text-center">Reception staff: use the login your doctor created for you.</p>}
        </motion.div>
      </div>
    </div>
  );
}
