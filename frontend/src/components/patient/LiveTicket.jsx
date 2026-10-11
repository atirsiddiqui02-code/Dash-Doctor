import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { MapPin, CheckCircle2, Sparkles, X, DoorOpen } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api, errMsg, etaClock } from "@/lib/api";

const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;

const Stat = ({ label, value, testid }) => (
  <div className="rounded-2xl bg-white/10 backdrop-blur p-4">
    <p className="text-xs text-blue-200">{label}</p>
    <motion.p key={value} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} data-testid={testid} className="font-mono-num text-2xl sm:text-3xl font-bold">{value}</motion.p>
  </div>
);

export const LiveTicket = ({ entry, onChange, onAskDai }) => {
  const [busy, setBusy] = useState(false);
  const inConsult = entry.status === "in_consult";
  const next = !inConsult && entry.ahead === 0;
  const act = async (path, msg) => {
    setBusy(true);
    try { await api.post(`/queue/${entry.id}/${path}`); toast.success(msg); onChange(); } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  const progress = inConsult ? 100 : Math.max(8, 100 - entry.ahead * 12);

  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} data-testid="patient-live-ticket-card"
      className={`relative ticket-surface grain rounded-[28px] p-6 sm:p-8 text-white overflow-hidden ${next || inConsult ? "pulse-ring" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-blue-200"><span className="live-dot" /> Live queue · Today</p>
          <p className="mt-3 font-display text-xl font-bold" data-testid="ticket-doctor-name">{entry.doctor.name}</p>
          <p className="text-sm text-blue-200 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{entry.doctor.specialty}{entry.doctor.clinic_name ? ` · ${entry.doctor.clinic_name}` : ""}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-blue-200">Token</p>
          <p data-testid="ticket-token-number" className="font-mono-num text-5xl sm:text-6xl font-extrabold leading-none">#{entry.token_no}</p>
        </div>
      </div>

      {inConsult ? (
        <div data-testid="ticket-your-turn-banner" className="mt-7 rounded-2xl bg-[var(--dai)] text-emerald-950 p-5 flex items-center gap-3">
          <DoorOpen className="w-7 h-7" /><div><p className="font-display font-extrabold text-xl">It's your turn</p><p className="text-sm">Please proceed to the doctor's room.</p></div>
        </div>
      ) : (
        <>
          {next && <p data-testid="ticket-youre-next-banner" className="mt-6 inline-flex items-center gap-2 bg-[var(--dai)] text-emerald-950 font-bold text-sm px-3 py-1.5 rounded-full">You're next — be ready!</p>}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Position" value={ordinal(entry.position)} testid="ticket-position" />
            <Stat label="ETA" value={`~${entry.eta_min}m`} testid="patient-eta-countdown" />
            <Stat label="Around" value={etaClock(entry.eta_min)} testid="ticket-eta-clock" />
          </div>
          <div className="mt-5 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.8 }} className="h-full bg-[var(--dai)]" />
          </div>
          <p className="mt-2 text-xs text-blue-200" data-testid="ticket-ahead-text">{entry.ahead === 0 ? "Nobody ahead of you" : `${entry.ahead} ${entry.ahead === 1 ? "patient" : "patients"} ahead · ~${entry.doctor.avg_consult_min} min each`}</p>
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-2 relative z-10">
        {!inConsult && (entry.checked_in ? (
          <span data-testid="ticket-checked-in-badge" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-white/15 text-sm"><CheckCircle2 className="w-4 h-4 text-[var(--dai)]" /> Checked in</span>
        ) : (
          <button data-testid="patient-checkin-button" disabled={busy} onClick={() => act("checkin", "Checked in at clinic")} className="h-10 px-4 rounded-full bg-white text-[var(--brand-dark)] font-semibold text-sm btn-lift">I've arrived — check in</button>
        ))}
        <button data-testid="ticket-ask-dai-button" onClick={onAskDai} className="h-10 px-4 rounded-full bg-[var(--dai)]/90 text-emerald-950 font-semibold text-sm inline-flex items-center gap-1.5 btn-lift"><Sparkles className="w-4 h-4" /> Ask Dai</button>
        {!inConsult && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button data-testid="patient-cancel-queue-button" className="h-10 px-4 rounded-full border border-white/30 text-sm inline-flex items-center gap-1.5 hover:bg-white/10 transition-colors"><X className="w-4 h-4" /> Leave queue</button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle>Leave this queue?</AlertDialogTitle>
                <AlertDialogDescription>You'll lose token #{entry.token_no}. You can rejoin, but you'll go to the back.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="cancel-dialog-keep-button">Keep my place</AlertDialogCancel>
                <AlertDialogAction data-testid="cancel-dialog-confirm-button" onClick={() => act("cancel", "You left the queue")} className="bg-red-600 hover:bg-red-700">Leave queue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </motion.div>
  );
};
