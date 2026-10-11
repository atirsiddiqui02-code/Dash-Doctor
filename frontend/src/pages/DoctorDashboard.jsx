import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell, PageHeading } from "@/components/AppShell";
import { FullLoader } from "@/components/Logo";
import { StatsRow } from "@/components/clinic/StatsRow";
import { QueueBoard } from "@/components/clinic/QueueBoard";
import { CurrentPatient } from "@/components/clinic/CurrentPatient";
import { DelayControl, WalkinDialog } from "@/components/clinic/ClinicControls";
import { SettingsPanel } from "@/components/clinic/SettingsPanel";
import { StaffPanel } from "@/components/clinic/StaffPanel";
import { usePoll } from "@/hooks/usePoll";

const tab = "rounded-full px-5 py-2 data-[state=active]:bg-[var(--brand)] data-[state=active]:text-white";

export default function DoctorDashboard() {
  const { data, refresh } = usePoll("/clinic/queue", 4000);
  if (!data) return <FullLoader />;
  const { doctor, entries, stats } = data;
  const current = entries.find((e) => e.status === "in_consult");
  const dateLabel = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

  return (
    <AppShell>
      <PageHeading eyebrow={dateLabel} title={doctor.name}
        sub={<span className="inline-flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${doctor.accepting ? "bg-[var(--dai)]" : "bg-slate-400"}`} />
          <span data-testid="doctor-accepting-status">{doctor.accepting ? "Accepting patients" : "Paused for new joins"}</span> · ~{doctor.avg_consult_min} min per consult</span>}
        right={<div className="flex flex-wrap gap-2"><DelayControl delay={doctor.delay_min} onChange={refresh} /><WalkinDialog onAdded={refresh} /></div>} />
      <Tabs defaultValue="today">
        <TabsList className="bg-white border border-slate-200 rounded-full p-1 h-auto mb-6">
          <TabsTrigger value="today" data-testid="doctor-tab-today" className={tab}>Today</TabsTrigger>
          <TabsTrigger value="settings" data-testid="doctor-tab-settings" className={tab}>Settings</TabsTrigger>
          <TabsTrigger value="staff" data-testid="doctor-tab-staff" className={tab}>Staff</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <StatsRow stats={stats} doctor={doctor} />
          <div className="grid lg:grid-cols-[1.25fr_1fr] gap-6 items-start">
            <CurrentPatient entry={current} waitingCount={stats.waiting} onChange={refresh} />
            <QueueBoard entries={entries} onChange={refresh} />
          </div>
        </TabsContent>
        <TabsContent value="settings"><SettingsPanel doctor={doctor} onSaved={refresh} /></TabsContent>
        <TabsContent value="staff"><StaffPanel /></TabsContent>
      </Tabs>
    </AppShell>
  );
}
