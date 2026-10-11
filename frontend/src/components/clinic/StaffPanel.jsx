import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePoll } from "@/hooks/usePoll";
import { api, errMsg } from "@/lib/api";

export const StaffPanel = () => {
  const { data, refresh } = usePoll("/clinic/staff", 30000);
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post("/clinic/staff", f); toast.success(`Login created for ${f.name}`); setF({ name: "", email: "", password: "" }); refresh(); } catch (ex) { toast.error(errMsg(ex)); }
    setBusy(false);
  };
  const remove = async (s) => {
    try { await api.delete(`/clinic/staff/${s.id}`); toast.success(`${s.name} removed`); refresh(); } catch (ex) { toast.error(errMsg(ex)); }
  };
  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
      <form onSubmit={add} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4" data-testid="staff-create-form">
        <p className="font-display font-bold text-lg">Create a reception login</p>
        <p className="text-sm text-slate-500 -mt-2">Staff can see your queue, send the next patient, add walk-ins and announce delays.</p>
        <div className="space-y-1.5"><Label>Name</Label><Input data-testid="staff-name-input" value={f.name} onChange={on("name")} required minLength={2} /></div>
        <div className="space-y-1.5"><Label>Email</Label><Input data-testid="staff-email-input" type="email" value={f.email} onChange={on("email")} required /></div>
        <div className="space-y-1.5"><Label>Temporary password</Label><Input data-testid="staff-password-input" type="text" value={f.password} onChange={on("password")} required minLength={6} /></div>
        <button data-testid="staff-create-button" disabled={busy} className="h-11 px-6 rounded-xl bg-[var(--brand)] text-white font-semibold btn-lift inline-flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Create login</button>
      </form>
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8">
        <p className="font-display font-bold text-lg mb-4">Your team</p>
        {data && data.length === 0 && <p className="text-sm text-slate-500">No staff yet.</p>}
        <div className="divide-y" data-testid="staff-list">
          {(data || []).map((s) => (
            <div key={s.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-semibold text-slate-900 truncate">{s.name}</p><p className="text-xs text-slate-500 truncate">{s.email}</p></div>
              <button data-testid={`staff-remove-${s.email}`} onClick={() => remove(s)} className="w-9 h-9 rounded-full grid place-items-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
