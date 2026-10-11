import { useEffect, useRef, useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { api, API, TOKEN_KEY } from "@/lib/api";

const SUGGESTED = ["How long until my turn?", "How many patients are ahead of me?", "How does the queue work?", "What should I bring to my visit?"];

const Bubble = ({ m }) => (
  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
    <div data-testid={`dai-message-${m.role}`} className={`max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed px-3.5 py-2.5 rounded-2xl ${m.role === "user" ? "bg-[var(--brand)] text-white rounded-br-md" : "bg-[var(--mint-soft)] text-emerald-950 rounded-bl-md"}`}>
      {m.content || <span className="inline-flex gap-1"><span className="live-dot" /><span className="live-dot" style={{ animationDelay: ".2s" }} /></span>}
    </div>
  </motion.div>
);

export const DaiChat = ({ open, onOpenChange, seed }) => {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    if (open) api.get("/dai/history").then((r) => setMsgs(r.data)).catch(() => {});
  }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  useEffect(() => { if (open && seed) send(seed); }, [open, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (q) => {
    const message = (q ?? text).trim();
    if (!message || busy) return;
    setText("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch(`${API}/dai/chat`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` },
        body: JSON.stringify({ message }),
      });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();
        for (const p of parts) {
          const line = p.replace(/^data: /, "");
          if (line === "[DONE]") continue;
          try {
            const { delta } = JSON.parse(line);
            setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], content: c[c.length - 1].content + delta }; return c; });
          } catch (_) { /* partial */ }
        }
      }
    } catch (_) {
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: "Sorry, I couldn't reach Dai. Try again." }; return c; });
    }
    setBusy(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="dai-chat-panel" className="w-full sm:max-w-md flex flex-col p-0 bg-white">
        <SheetHeader className="px-5 py-4 border-b text-left">
          <SheetTitle className="flex items-center gap-2 font-display">
            <span className="w-8 h-8 rounded-full bg-[var(--dai)] grid place-items-center"><Sparkles className="w-4 h-4 text-emerald-950" /></span>
            Ask Dai
          </SheetTitle>
          <SheetDescription className="text-xs">Your queue assistant. Not a substitute for medical advice — in an emergency, call local emergency services.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {msgs.length === 0 && <p className="text-sm text-slate-500">Hi! Ask me about your position, ETA, or how Dr.D works.</p>}
          <AnimatePresence>{msgs.map((m, i) => <Bubble key={i} m={m} />)}</AnimatePresence>
          <div ref={end} />
        </div>
        <div className="px-5 pt-2 flex flex-wrap gap-1.5">
          {SUGGESTED.map((s, i) => (
            <button key={s} data-testid={`dai-suggestion-${i}`} disabled={busy} onClick={() => send(s)} className="text-[11px] px-2.5 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-4 flex gap-2">
          <input data-testid="dai-chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question…" className="flex-1 h-11 px-4 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--dai)] text-sm" />
          <button data-testid="dai-chat-send-button" disabled={busy || !text.trim()} className="w-11 h-11 rounded-full bg-[var(--mint)] text-white grid place-items-center btn-lift disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export const DaiFab = ({ onClick }) => (
  <button data-testid="dai-chat-fab-button" onClick={onClick} className="fixed bottom-6 right-6 z-40 h-14 pl-4 pr-5 rounded-full bg-[var(--dai)] text-emerald-950 font-display font-bold flex items-center gap-2 dai-glow btn-lift">
    <Sparkles className="w-5 h-5" /> Ask Dai
  </button>
);
