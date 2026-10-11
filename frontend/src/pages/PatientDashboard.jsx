import { useState } from "react";
import { Ticket } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell, PageHeading } from "@/components/AppShell";
import { LiveTicket } from "@/components/patient/LiveTicket";
import { DoctorList } from "@/components/patient/DoctorList";
import { History } from "@/components/patient/History";
import { DaiChat, DaiFab } from "@/components/DaiChat";
import { usePoll } from "@/hooks/usePoll";
import { useAuth } from "@/context/AuthContext";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

export default function PatientDashboard() {
  const { user } = useAuth();
  const { data: tickets, refresh } = usePoll("/patient/queue", 5000);
  const [dai, setDai] = useState({ open: false, seed: null });
  const list = tickets || [];

  return (
    <AppShell>
      <PageHeading eyebrow="Patient dashboard" title={`${greeting()}, ${user.name.split(" ")[0]}`}
        sub={list.length ? "Your live place in line updates automatically." : "Pick a doctor and hold your place in today's queue — free."} />

      <section className="mb-12">
        {list.length === 0 && tickets && (
          <div data-testid="no-active-ticket" className="rounded-3xl border-2 border-dashed border-slate-300 p-8 flex items-center gap-4 text-slate-500">
            <Ticket className="w-8 h-8 text-slate-400" /> You're not in any queue today. Join one below.
          </div>
        )}
        <div className="grid lg:grid-cols-2 gap-6">
          {list.map((t) => <LiveTicket key={t.id} entry={t} onChange={refresh} onAskDai={() => setDai({ open: true, seed: "How long until my turn?" })} />)}
        </div>
      </section>

      <Tabs defaultValue="doctors">
        <TabsList className="bg-white border border-slate-200 rounded-full p-1 h-auto mb-6">
          <TabsTrigger value="doctors" data-testid="tab-find-doctor" className="rounded-full px-5 py-2 data-[state=active]:bg-[var(--brand)] data-[state=active]:text-white">Find a doctor</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history" className="rounded-full px-5 py-2 data-[state=active]:bg-[var(--brand)] data-[state=active]:text-white">Visit history</TabsTrigger>
        </TabsList>
        <TabsContent value="doctors"><DoctorList joinedIds={list.map((t) => t.doctor.id)} onJoined={refresh} /></TabsContent>
        <TabsContent value="history"><History /></TabsContent>
      </Tabs>

      <DaiFab onClick={() => setDai({ open: true, seed: null })} />
      <DaiChat open={dai.open} seed={dai.seed} onOpenChange={(o) => setDai({ open: o, seed: null })} />
    </AppShell>
  );
}
