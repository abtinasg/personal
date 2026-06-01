"use client";

import { useEffect, useRef, useState } from "react";
import { apiSend } from "@/lib/client";
import { Sheet, Spinner } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";

type Saved = { type: string; label: string };
type Msg = { role: "user" | "assistant"; content: string; saved?: Saved[] };

const SUGGESTIONS = [
  "نهارِ امروز چلوکباب با دوغ بود",
  "امروز بی‌حال و بی‌انگیزه‌ام",
  "یه عادت کوچیک برای شروع پیشنهاد بده",
];

export default function CoachChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setErr("");
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const { reply, saved } = await apiSend<{ reply: string; saved?: Saved[] }>("/api/coach/chat", "POST", { messages: next });
      setMsgs((m) => [...m, { role: "assistant", content: reply, saved }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا در ارتباط با مربی.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="مربیِ تو">
      <div className="flex flex-col" style={{ height: "min(70vh, 560px)" }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 py-2">
          {msgs.length === 0 && !busy && (
            <div className="text-center py-6">
              <div className="h-16 w-16 mx-auto mb-3 rounded-[20px] bg-ios-blue/10 text-ios-blue flex items-center justify-center"><AppIcon name="compass" size={30} /></div>
              <p className="font-bold text-[17px]">با مربی‌ات حرف بزن</p>
              <p className="secondary text-[14px] mt-1 leading-relaxed px-4">
                هرچی تو ذهنته بگو — مربی هویت‌ها، عادت‌ها و ماموریتِ تو رو می‌شناسه. حتی بگو چی خوردی، خودش برات ثبت می‌کنه.
              </p>
              <div className="flex flex-col gap-2 mt-5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="ios-btn-ghost !py-2.5 !text-[14px] mx-auto"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === "user" ? "items-start" : "items-end"}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-7 whitespace-pre-wrap ${
                  m.role === "user"
                    ? "text-white"
                    : "bg-black/[0.05] dark:bg-white/[0.08]"
                }`}
                style={m.role === "user" ? { backgroundImage: "linear-gradient(135deg, #5b76f0, #8267f2)" } : undefined}
              >
                {m.content}
              </div>
              {m.saved && m.saved.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[82%] justify-end">
                  {m.saved.map((s, j) => (
                    <span key={j} className="inline-flex items-center gap-1.5 rounded-full bg-ios-green/15 text-ios-green text-[12.5px] font-medium px-2.5 py-1">
                      <AppIcon name={s.type} size={13} /> {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div className="flex justify-end">
              <div className="rounded-2xl px-4 py-3 bg-black/[0.05] dark:bg-white/[0.08]"><Spinner className="!h-4 !w-4" /></div>
            </div>
          )}
        </div>

        {err && <p className="text-ios-red text-[13px] px-1 pb-1">{err}</p>}

        <div className="flex items-end gap-2 pt-2 border-t border-[var(--sep)]">
          <textarea
            className="ios-input flex-1 min-h-[46px] max-h-[120px] resize-none !py-2.5"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="پیامت رو بنویس…"
            rows={1}
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="h-[46px] w-[46px] shrink-0 rounded-2xl text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
            style={{ backgroundImage: "linear-gradient(135deg, #5b76f0, #8267f2)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
            </svg>
          </button>
        </div>
      </div>
    </Sheet>
  );
}
