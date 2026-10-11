import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Loader2, Megaphone } from "lucide-react";
import { AppShell, PageHeading } from "@/components/AppShell";
import { FullLoader } from "@/components/Logo";
import { StatsRow } from "@/components/clinic/StatsRow";
import { QueueBoard } from "@/components/clinic/QueueBoard";
import { DelayControl, WalkinDialog } from "@/components/clinic/ClinicControls";
import { usePoll } from "@/hooks/usePoll";
import { api, errMsg } from "@/lib/api";

const NowServing = ({ current, upNext, onNext, busy, canNext }) => (
  <div className="relative ticket-surface grain rounded-[28px] p-7 sm:p-9 text-white overflow-hidden mb-6">
    <div className="grid md:grid-cols-[1fr_1fr_auto] gap-8 items-center relative z-10">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-blue-200 flex items-center gap-2"><span className="live-dot" /> Now serving</p>
        <AnimatePresence mode="wait">
          <motion.div key={current?.id || "none"} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }}>
            <p data-testid="staff-now-serving-token" className="font-mono-num text-7xl font-extrabold leading-none mt-2">{current ? `#${current.token_no}` : "—"}</p>
            <p data-testid="staff-now-serving-name" className="mt-2 text-blue-100">{current ? current.patient_name : "Nobody in consult"}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="md:border-l md:border-white/15 md:pl-8">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-200">Up next</p>
        <p data-testid="staff-up-next" className="font-mono-num text-4xl font-bold mt-2">{upNext ? `#${upNext.token_no}` : "—"}</p>
        <p className="mt-1 text-blue-100 text-sm truncate">{upNext ? `${upNext.patient_name}${upNext.checked_in ? " · arrived" : " · not arrived yet"}` : "Queue empty"}</p>
      </div>
      <button data-testid="staff-send-next-button" onClick={onNext} disabled={busy || !canNext}
        className="h-16 px-8 rounded-2xl bg-[var(--dai)] text-emerald-950 font-display font-extrabold text-lg flex items-center gap-2 dai-glow btn-lift disabled:opacity-40 disabled:shadow-none">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Megaphone className="w-5 h-5" />} Send next patient <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  </div>
);

export default function StaffDashboard() {
  const { data, refresh } = usePoll("/clinic/queue", 4000);
  const [busy, setBusy] = useState(false);
  if (!data) return <FullLoader />;
  const { doctor, entries, stats } = data;
  const current = entries.find((e) => e.status === "in_consult");
  const upNext = entries.filter((e) => e.status === "waiting").sort((a, b) => a.token_no - b.token_no)[0];
  const sendNext = async () => {
    setBusy(true);
    try {
      const { data: r } = await api.post("/clinic/next", {});
      toast.success(r.called ? `Sent #${r.called.token_no} — ${r.called.patient_name} to ${doctor.name}` : "Consult marked complete. No one waiting.");
      refresh();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <AppShell>
      <PageHeading eyebrow="Reception desk" title={`${doctor.name}'s queue`} sub={`${doctor.specialty}${doctor.clinic_name ? ` · ${doctor.clinic_name}` : ""} · ~${doctor.avg_consult_min} min per consult`}
        right={<div className="flex flex-wrap gap-2"><DelayControl delay={doctor.delay_min} onChange={refresh} /><WalkinDialog onAdded={refresh} /></div>} />
      <NowServing current={current} upNext={upNext} onNext={sendNext} busy={busy} canNext={!!current || !!upNext} />
      <StatsRow stats={stats} doctor={doctor} />
      <QueueBoard entries={entries} onChange={refresh} />
    </AppShell>
  );
}
