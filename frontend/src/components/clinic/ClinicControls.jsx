import { useState } from "react";
import { toast } from "sonner";
import { Timer, UserPlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errMsg } from "@/lib/api";

export const DelayControl = ({ delay, onChange }) => {
  const bump = async (minutes) => {
    try {
      const { data } = await api.post("/clinic/delay", { minutes });
      toast.success(minutes > 0 ? `Waiting patients notified: +${minutes} min` : `Delay now ${data.delay_min} min`);
      onChange();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-4 pr-1.5 h-11" data-testid="delay-control">
      <Timer className="w-4 h-4 text-amber-600" />
      <span className="text-sm text-slate-700">Delay <b data-testid="delay-value" className="font-mono-num">{delay}m</b></span>
      <button data-testid="delay-minus-button" disabled={!delay} onClick={() => bump(-15)} className="h-8 px-3 rounded-full text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">−15</button>
      <button data-testid="doctor-delay-15m-button" onClick={() => bump(15)} className="h-8 px-3 rounded-full text-sm font-semibold bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors">+15m</button>
    </div>
  );
};

export const WalkinDialog = ({ onAdded }) => {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/clinic/walkin", f);
      toast.success(`Walk-in added — token #${data.token_no}`);
      setF({ name: "", phone: "", reason: "" }); setOpen(false); onAdded();
    } catch (ex) { toast.error(errMsg(ex)); }
    setBusy(false);
  };
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button data-testid="staff-add-walkin-button" className="h-11 px-5 rounded-full border-2 border-[var(--brand)] text-[var(--brand)] font-semibold text-sm inline-flex items-center gap-2 btn-lift hover:bg-[var(--brand)] hover:text-white">
          <UserPlus className="w-4 h-4" /> Add walk-in
        </button>
      </DialogTrigger>
      <DialogContent className="bg-white sm:max-w-md" data-testid="walkin-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl">Add walk-in patient</DialogTitle><DialogDescription>They'll join the end of today's queue.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Patient name</Label><Input data-testid="walkin-name-input" value={f.name} onChange={on("name")} required minLength={2} /></div>
          <div className="space-y-1.5"><Label>Phone (optional)</Label><Input data-testid="walkin-phone-input" value={f.phone} onChange={on("phone")} /></div>
          <div className="space-y-1.5"><Label>Reason for visit</Label><Input data-testid="walkin-reason-input" value={f.reason} onChange={on("reason")} required minLength={2} /></div>
          <button data-testid="walkin-submit-button" disabled={busy} className="w-full h-12 rounded-xl bg-[var(--brand)] text-white font-semibold btn-lift flex items-center justify-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Add to queue</button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
