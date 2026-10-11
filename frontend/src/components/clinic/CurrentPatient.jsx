import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sparkles, RefreshCw, ArrowRight, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { api, errMsg, fmtTime } from "@/lib/api";

const DaiBrief = ({ entry }) => {
  const [brief, setBrief] = useState(entry.dai_brief || "");
  const [busy, setBusy] = useState(false);
  const load = async (force = false) => {
    setBusy(true);
    try { const { data } = await api.post(`/dai/brief/${entry.id}${force ? "?force=true" : ""}`); setBrief(data.brief); } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  useEffect(() => { if (!entry.dai_brief) load(); else setBrief(entry.dai_brief); }, [entry.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-testid="doctor-dai-brief-panel" className="rounded-2xl bg-[var(--brand-dark)] text-white p-5 relative overflow-hidden grain">
      <div className="flex items-center justify-between relative z-10">
        <p className="flex items-center gap-2 font-display font-bold text-[var(--dai)]"><Sparkles className="w-4 h-4" /> Dai brief</p>
        <button data-testid="dai-brief-refresh-button" onClick={() => load(true)} disabled={busy} className="text-xs text-blue-200 hover:text-white inline-flex items-center gap-1"><RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> Regenerate</button>
      </div>
      <div data-testid="dai-brief-text" className="mt-3 text-sm leading-relaxed text-blue-50 whitespace-pre-wrap relative z-10 min-h-[80px]">
        {busy && !brief ? <span className="inline-flex items-center gap-2 text-blue-200"><Loader2 className="w-4 h-4 animate-spin" /> Dai is reading the patient's notes…</span> : brief}
      </div>
    </div>
  );
};

export const CurrentPatient = ({ entry, waitingCount, onChange }) => {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setNotes(""), [entry?.id]);
  const next = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/clinic/next", { notes });
      toast.success(data.called ? `Now seeing #${data.called.token_no} — ${data.called.patient_name}` : "Consult completed. Queue is clear.");
      onChange();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7" data-testid="current-patient-card">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mint)]">In consult now</p>
      <AnimatePresence mode="wait">
        {entry ? (
          <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 data-testid="current-patient-name" className="font-display text-3xl font-extrabold text-slate-900 truncate">{entry.patient_name}</h2>
                <p className="text-sm text-slate-500">Called at {fmtTime(entry.called_at)}{entry.patient_phone ? ` · ${entry.patient_phone}` : ""}</p>
              </div>
              <span data-testid="current-patient-token" className="font-mono-num text-4xl font-extrabold text-[var(--brand)]">#{entry.token_no}</span>
            </div>
            <div className="mt-5 grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3.5"><p className="text-xs text-slate-500">Reason</p><p className="font-medium text-slate-900">{entry.reason}</p></div>
              <div className="rounded-xl bg-slate-50 p-3.5"><p className="text-xs text-slate-500">Symptoms</p><p className="font-medium text-slate-900">{entry.symptoms || "—"}</p></div>
            </div>
            <div className="mt-5"><DaiBrief entry={entry} /></div>
            <Textarea data-testid="consult-notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Consult notes (saved to this visit, helps Dai next time)" rows={3} className="mt-5 rounded-xl" />
          </motion.div>
        ) : (
          <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-slate-500" data-testid="no-current-patient">
            No one in consult. {waitingCount ? `${waitingCount} waiting — call the first patient.` : "The queue is empty."}
          </motion.p>
        )}
      </AnimatePresence>
      <button data-testid="doctor-call-next-button" onClick={next} disabled={busy || (!entry && !waitingCount)}
        className="mt-6 w-full h-14 rounded-2xl bg-[var(--mint)] hover:bg-emerald-700 text-white font-display font-bold text-lg btn-lift flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-emerald-600/20">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        {entry ? (waitingCount ? "Complete & call next" : "Complete consult") : "Call first patient"} <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};
