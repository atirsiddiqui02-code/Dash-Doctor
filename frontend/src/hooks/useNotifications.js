import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { usePoll } from "@/hooks/usePoll";

const browserNotify = (n) => {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try { new Notification(n.title, { body: n.body, tag: n.id }); } catch (_) { /* ignore */ }
};

export function useNotifications() {
  const { data, refresh } = usePoll("/notifications", 5000);
  const seen = useRef(null);
  const [perm, setPerm] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);

  useEffect(() => {
    if (!data) return;
    if (seen.current === null) {
      seen.current = new Set(data.map((n) => n.id));
      return;
    }
    data.filter((n) => !seen.current.has(n.id)).reverse().forEach((n) => {
      seen.current.add(n.id);
      if (n.read) return;
      const strong = ["next", "called"].includes(n.type);
      (strong ? toast.success : toast.info)(n.title, { description: n.body, duration: strong ? 12000 : 6000 });
      browserNotify(n);
    });
  }, [data]);

  const markAll = async () => { await api.post("/notifications/read-all"); refresh(); };
  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    setPerm(await Notification.requestPermission());
  };

  const items = data || [];
  return { items, unread: items.filter((n) => !n.read).length, markAll, perm, askPermission };
}
