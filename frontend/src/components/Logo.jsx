import { Link } from "react-router-dom";

export const Logo = ({ to = "/", light = false }) => (
  <Link to={to} data-testid="brand-logo-link" className="flex items-center gap-2.5 group">
    <span className="relative grid place-items-center w-9 h-9 rounded-xl ticket-surface text-white font-display font-extrabold text-sm shadow-md transition-transform duration-300 group-hover:rotate-[-6deg]">
      D<span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--dai)] ring-2 ring-white" />
    </span>
    <span className={`font-display font-extrabold text-xl tracking-tight ${light ? "text-white" : "text-[var(--brand-dark)]"}`}>
      Dr.D
    </span>
  </Link>
);

export const FullLoader = () => (
  <div data-testid="full-page-loader" className="min-h-screen grid place-items-center">
    <div className="flex items-center gap-3 text-slate-500">
      <span className="live-dot" /> Loading your clinic…
    </div>
  </div>
);
