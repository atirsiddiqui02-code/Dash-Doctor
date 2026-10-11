import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Search, Clock, Users, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { usePoll } from "@/hooks/usePoll";
import { api, errMsg } from "@/lib/api";

const JoinDialog = ({ doctor, onClose, onJoined }) => {
  const [reason, setReason] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/queue/join", { doctor_id: doctor.id, reason, symptoms });
      toast.success(`You're in! Token #${data.token_no}`, { description: `Position ${data.position} · ETA ~${data.eta_min} min` });
      onJoined(); onClose();
    } catch (ex) { toast.error(errMsg(ex)); }
    setBusy(false);
  };
  return (
    <Dialog open={!!doctor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white sm:max-w-md" data-testid="join-queue-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Join {doctor?.name}'s queue</DialogTitle>
          <DialogDescription>Estimated wait if you join now: ~{doctor?.est_wait_min} min. Dai shares this with the doctor before your consult.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="reason">Reason for visit</Label>
            <Input id="reason" data-testid="join-reason-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fever for 3 days" required minLength={2} /></div>
          <div className="space-y-1.5"><Label htmlFor="symptoms">Symptoms / notes (optional)</Label>
            <Textarea id="symptoms" data-testid="join-symptoms-input" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Anything the doctor should know" rows={3} /></div>
          <button data-testid="patient-join-queue-submit-button" disabled={busy} className="w-full h-12 rounded-xl bg-[var(--mint)] hover:bg-emerald-700 text-white font-semibold btn-lift flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Hold my place
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DoctorCard = ({ d, i, onJoin, joined }) => {
  const full = d.spots_left === 0;
  const disabled = !d.accepting || full || joined;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} data-testid={`doctor-card-${d.id}`}
      className="group bg-white rounded-3xl border border-slate-200 p-6 hover:border-[var(--brand)]/40 hover:shadow-lg hover:shadow-blue-900/5 transition-[box-shadow,border-color] duration-300 flex flex-col">
      <div className="flex items-start gap-4">
        <span className="w-12 h-12 rounded-2xl ticket-surface text-white font-display font-bold grid place-items-center shrink-0">{d.name.replace(/^Dr\.?\s*/i, "").charAt(0)}</span>
        <div className="min-w-0">
          <p className="font-display font-bold text-lg text-slate-900 truncate">{d.name}</p>
          <p className="text-sm text-slate-500 truncate">{d.specialty}{d.clinic_name ? ` · ${d.clinic_name}` : ""}{d.city ? ` · ${d.city}` : ""}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-[var(--brand)] font-medium"><Clock className="w-3.5 h-3.5" /> ~{d.est_wait_min} min wait</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium"><Users className="w-3.5 h-3.5" />{d.spots_left == null ? "Open queue" : `${d.spots_left} spots left`}</span>
        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">Starts {d.start_time}</span>
      </div>
      <button data-testid={`patient-join-queue-button-${d.id}`} disabled={disabled} onClick={() => onJoin(d)}
        className="mt-6 h-11 rounded-xl font-semibold text-sm btn-lift bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed">
        {joined ? "You're in this queue" : !d.accepting ? "Not accepting today" : full ? "Queue full today" : "Join today's queue"}
      </button>
    </motion.div>
  );
};

export const DoctorList = ({ joinedIds, onJoined }) => {
  const [q, setQ] = useState("");
  const { data, refresh } = usePoll(`/doctors${q ? `?q=${encodeURIComponent(q)}` : ""}`, 15000);
  const [picked, setPicked] = useState(null);
  return (
    <div>
      <div className="relative max-w-md mb-6">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input data-testid="doctor-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search doctor, specialty, clinic or city" className="h-12 pl-11 rounded-full bg-white" />
      </div>
      {data && data.length === 0 && <p data-testid="doctor-list-empty" className="text-slate-500 text-sm">No doctors found.</p>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5" data-testid="doctor-list">
        {(data || []).map((d, i) => <DoctorCard key={d.id} d={d} i={i} onJoin={setPicked} joined={joinedIds.includes(d.id)} />)}
      </div>
      <JoinDialog doctor={picked} onClose={() => setPicked(null)} onJoined={() => { onJoined(); refresh(); }} />
    </div>
  );
};
