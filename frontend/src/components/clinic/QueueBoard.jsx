import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PhoneCall, SkipForward, RotateCcw, CheckCircle2, Footprints } from "lucide-react";
import { api, errMsg, fmtTime } from "@/lib/api";

const Row = ({ e, onAct }) => (
  <motion.div layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} data-testid={`queue-row-${e.token_no}`}
    className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl ${e.status === "in_consult" ? "bg-[var(--mint-soft)]" : "hover:bg-slate-50"} transition-colors`}>
    <span className={`font-mono-num font-bold text-lg w-14 text-center rounded-xl py-1.5 ${e.status === "in_consult" ? "bg-[var(--mint)] text-white" : "bg-slate-100 text-slate-800"}`}>#{e.token_no}</span>
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-slate-900 truncate flex items-center gap-2">
        {e.patient_name}
        {e.walk_in && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 inline-flex items-center gap-1"><Footprints className="w-3 h-3" />Walk-in</span>}
        {e.checked_in && !e.walk_in && e.status === "waiting" && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Arrived</span>}
      </p>
      <p className="text-xs text-slate-500 truncate">{e.reason}{e.status === "waiting" ? ` · ETA ~${e.eta_min}m` : e.status === "in_consult" ? ` · since ${fmtTime(e.called_at)}` : ""}</p>
    </div>
    <div className="flex gap-1">
      {e.status === "waiting" && <IconBtn testid={`queue-call-${e.token_no}`} title="Call now" onClick={() => onAct(e, "call", `Calling #${e.token_no}`)}><PhoneCall className="w-4 h-4" /></IconBtn>}
      {["waiting", "in_consult"].includes(e.status) && <IconBtn testid={`queue-skip-${e.token_no}`} title="Mark missed" onClick={() => onAct(e, "skip", `#${e.token_no} marked missed`)}><SkipForward className="w-4 h-4" /></IconBtn>}
      {e.status === "skipped" && <IconBtn testid={`queue-recall-${e.token_no}`} title="Recall to queue" onClick={() => onAct(e, "recall", `#${e.token_no} back in queue`)}><RotateCcw className="w-4 h-4" /></IconBtn>}
    </div>
  </motion.div>
);

const IconBtn = ({ children, testid, ...p }) => (
  <button data-testid={testid} {...p} className="w-9 h-9 rounded-full grid place-items-center text-slate-600 hover:bg-[var(--brand)] hover:text-white transition-colors">{children}</button>
);

export const QueueBoard = ({ entries, onChange }) => {
  const [showDone, setShowDone] = useState(false);
  const onAct = async (e, action, msg) => {
    try { await api.post(`/clinic/queue/${e.id}/${action}`); toast.success(msg); onChange(); } catch (ex) { toast.error(errMsg(ex)); }
  };
  const live = entries.filter((e) => ["in_consult", "waiting"].includes(e.status)).sort((a, b) => (a.status === "in_consult" ? -1 : b.status === "in_consult" ? 1 : a.token_no - b.token_no));
  const skipped = entries.filter((e) => e.status === "skipped");
  const done = entries.filter((e) => e.status === "done");
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5" data-testid="queue-board">
      <div className="flex items-center justify-between px-2 mb-3">
        <p className="font-display font-bold text-slate-900 flex items-center gap-2"><span className="live-dot" /> Today's queue</p>
        <span className="text-xs text-slate-500">{live.length} active</span>
      </div>
      {live.length === 0 && <p data-testid="queue-empty" className="px-2 py-10 text-center text-sm text-slate-500">Queue is clear. New patients will appear here live.</p>}
      <AnimatePresence initial={false}>{live.map((e) => <Row key={e.id} e={e} onAct={onAct} />)}</AnimatePresence>
      {skipped.length > 0 && <><p className="px-2 mt-5 mb-1 text-xs font-semibold uppercase tracking-wider text-amber-600">Missed</p>{skipped.map((e) => <Row key={e.id} e={e} onAct={onAct} />)}</>}
      {done.length > 0 && (
        <button data-testid="toggle-done-list" onClick={() => setShowDone(!showDone)} className="mt-4 px-2 text-xs font-semibold text-slate-500 hover:text-[var(--brand)] inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> {showDone ? "Hide" : "Show"} {done.length} seen today
        </button>
      )}
      {showDone && done.map((e) => (
        <div key={e.id} className="flex items-center gap-4 px-4 py-2 text-sm text-slate-500"><span className="font-mono-num w-14 text-center">#{e.token_no}</span><span className="truncate">{e.patient_name} · {e.reason}</span></div>
      ))}
    </div>
  );
};
