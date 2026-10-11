import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL = { doctor: "Doctor", staff: "Reception", patient: "Patient" };

export const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const initial = (user?.name || "?").replace(/^Dr\.?\s*/i, "").charAt(0).toUpperCase();
  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <header className="sticky top-0 z-40 h-16 bg-white/85 backdrop-blur-xl border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo to={nav ? undefined : "/"} />
            <span data-testid="role-badge" className="hidden sm:inline-flex text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--mint-soft)] text-emerald-800">
              {ROLE_LABEL[user?.role]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="user-menu-button" className="w-10 h-10 rounded-full ticket-surface text-white font-display font-bold grid place-items-center btn-lift">
                  {initial}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white">
                <DropdownMenuLabel>
                  <p className="font-semibold text-slate-900 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 font-normal truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="logout-button" onClick={async () => { await logout(); nav("/login"); }} className="cursor-pointer text-red-600 focus:text-red-700">
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10"
      >
        {children}
      </motion.main>
    </div>
  );
};

export const PageHeading = ({ eyebrow, title, sub, right }) => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
    <div>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mint)] mb-2">{eyebrow}</p>}
      <h1 data-testid="page-title" className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      {sub && <p className="text-slate-500 mt-1.5 text-sm sm:text-base">{sub}</p>}
    </div>
    {right}
  </div>
);
