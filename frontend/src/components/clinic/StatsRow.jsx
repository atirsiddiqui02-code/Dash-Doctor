import { motion } from "framer-motion";

const ITEMS = [
  ["waiting", "Waiting", "text-[var(--brand)]"],
  ["in_consult", "In consult", "text-[var(--mint)]"],
  ["done", "Seen today", "text-slate-900"],
  ["skipped", "Missed", "text-amber-600"],
];

export const StatsRow = ({ stats, doctor }) => (
  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
    {ITEMS.map(([k, l, c], i) => (
      <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-xs text-slate-500">{l}</p>
        <p data-testid={`stat-${k}`} className={`font-mono-num text-3xl font-bold ${c}`}>{stats[k]}</p>
      </motion.div>
    ))}
    <div className="bg-white rounded-2xl border border-slate-200 p-4 col-span-2 md:col-span-1">
      <p className="text-xs text-slate-500">Daily cap</p>
      <p data-testid="stat-cap" className="font-mono-num text-3xl font-bold text-slate-900">{stats.total}<span className="text-base text-slate-400">/{doctor.daily_cap || "∞"}</span></p>
    </div>
  </div>
);
