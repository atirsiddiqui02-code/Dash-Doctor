import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { api, errMsg } from "@/lib/api";

const F = ({ id, label, hint, ...p }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} data-testid={`settings-${id}-input`} className="h-11 rounded-xl" {...p} />
    {hint && <p className="text-xs text-slate-500">{hint}</p>}
  </div>
);

export const SettingsPanel = ({ doctor, onSaved }) => {
  const [f, setF] = useState(doctor);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(doctor), [doctor.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const on = (k, num) => (e) => setF({ ...f, [k]: num ? Number(e.target.value) : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { name, specialty, clinic_name, city, bio, phone, avg_consult_min, daily_cap, start_time, accepting } = f;
      await api.patch("/clinic/settings", { name, specialty, clinic_name, city, bio, phone, avg_consult_min, daily_cap, start_time, accepting });
      toast.success("Settings saved"); onSaved();
    } catch (ex) { toast.error(errMsg(ex)); }
    setBusy(false);
  };
  return (
    <form onSubmit={save} className="grid lg:grid-cols-2 gap-6" data-testid="settings-form">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5">
        <p className="font-display font-bold text-lg">Queue rules</p>
        <div className="flex items-center justify-between rounded-2xl bg-[var(--mint-soft)] p-4">
          <div><p className="font-semibold text-emerald-950">Accepting patients today</p><p className="text-xs text-emerald-800">Turn off to pause new online joins.</p></div>
          <Switch data-testid="settings-accepting-switch" checked={!!f.accepting} onCheckedChange={(v) => setF({ ...f, accepting: v })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F id="avg_consult_min" label="Avg consult (min)" type="number" min={1} max={180} value={f.avg_consult_min} onChange={on("avg_consult_min", true)} hint="Used for every patient's ETA" />
          <F id="daily_cap" label="Max patients / day" type="number" min={0} max={1000} value={f.daily_cap} onChange={on("daily_cap", true)} hint="0 = no cap" />
        </div>
        <F id="start_time" label="Consults start at" type="time" value={f.start_time} onChange={on("start_time")} />
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5">
        <p className="font-display font-bold text-lg">Public profile</p>
        <F id="name" label="Display name" value={f.name} onChange={on("name")} />
        <div className="grid grid-cols-2 gap-4">
          <F id="specialty" label="Specialty" value={f.specialty} onChange={on("specialty")} />
          <F id="phone" label="Phone" value={f.phone || ""} onChange={on("phone")} />
          <F id="clinic_name" label="Clinic name" value={f.clinic_name} onChange={on("clinic_name")} />
          <F id="city" label="City" value={f.city} onChange={on("city")} />
        </div>
        <div className="space-y-1.5"><Label>Short bio</Label><Textarea data-testid="settings-bio-input" rows={3} value={f.bio || ""} onChange={on("bio")} className="rounded-xl" /></div>
      </div>
      <div className="lg:col-span-2">
        <button data-testid="settings-save-button" disabled={busy} className="h-12 px-8 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-semibold btn-lift inline-flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save settings</button>
      </div>
    </form>
  );
};
