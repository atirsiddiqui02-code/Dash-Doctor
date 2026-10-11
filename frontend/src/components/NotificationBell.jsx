import { Bell, BellRing } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { fmtTime } from "@/lib/api";

export const NotificationBell = () => {
  const { items, unread, markAll, perm, askPermission } = useNotifications();
  return (
    <Popover onOpenChange={(o) => !o && unread && markAll()}>
      <PopoverTrigger asChild>
        <button data-testid="notification-bell-button" className="relative w-10 h-10 grid place-items-center rounded-full hover:bg-slate-100 transition-colors">
          {unread ? <BellRing className="w-5 h-5 text-[var(--brand)]" /> : <Bell className="w-5 h-5 text-slate-600" />}
          {unread > 0 && (
            <span data-testid="notification-unread-count" className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--mint)] text-white text-[10px] font-bold grid place-items-center">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-white" data-testid="notification-panel">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="font-display font-semibold text-slate-900">Live alerts</p>
          {unread > 0 && <button data-testid="notification-mark-read-button" onClick={markAll} className="text-xs text-[var(--brand)] hover:underline">Mark all read</button>}
        </div>
        {perm === "default" && (
          <button data-testid="enable-browser-notifications-button" onClick={askPermission} className="w-full text-left px-4 py-2.5 text-xs bg-[var(--mint-soft)] text-emerald-900 hover:bg-emerald-100 transition-colors">
            Enable browser notifications so we can ping you even in another tab →
          </button>
        )}
        <ScrollArea className="max-h-80">
          {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No alerts yet.</p>}
          {items.map((n) => (
            <div key={n.id} data-testid="notification-item" className={`px-4 py-3 border-b last:border-0 ${n.read ? "" : "bg-blue-50/50"}`}>
              <div className="flex justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                <span className="text-[10px] text-slate-400 shrink-0">{fmtTime(n.created_at)}</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">{n.body}</p>
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
