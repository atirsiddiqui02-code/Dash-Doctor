import { usePoll } from "@/hooks/usePoll";

const TONE = { done: "bg-emerald-50 text-emerald-700", cancelled: "bg-slate-100 text-slate-600", skipped: "bg-amber-50 text-amber-700" };

export const History = () => {
  const { data } = usePoll("/patient/history", 30000);
  if (!data) return null;
  if (!data.length) return <p data-testid="history-empty" className="text-sm text-slate-500">No past visits yet.</p>;
  return (
    <div className="bg-white rounded-3xl border border-slate-200 divide-y" data-testid="patient-history-list">
      {data.map((e) => (
        <div key={e.id} className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{e.doctor_name}</p>
            <p className="text-sm text-slate-500 truncate">{e.date} · Token #{e.token_no} · {e.reason}</p>
          </div>
          <span className={`text-xs font-semibold capitalize px-2.5 py-1 rounded-full ${TONE[e.status]}`}>{e.status === "done" ? "Completed" : e.status}</span>
        </div>
      ))}
    </div>
  );
};
