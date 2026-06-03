"use client";

import { useEffect, useRef, useState } from "react";
import { apiSend } from "@/lib/client";
import { Sheet, Spinner } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "با مازادِ این ماه چطور شروع کنم به سرمایه‌گذاری؟",
  "فرقِ طلا، دلار و صندوق برای حفظِ ارزشِ پول چیه؟",
  "تورم چطور هدفِ خریدم رو جابه‌جا می‌کنه؟",
];

export default function InvestChat({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      const { reply } = await apiSend<{ reply: string }>("/api/coach/invest", "POST", { messages: next });
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا در ارتباط با مشاور.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="مشاورِ سرمایه" fillHeight>
      <div className="flex flex-col flex-1 min-h-0">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 py-2">
          {msgs.length === 0 && !busy && (
            <div className="text-center py-6">
              <div className="h-16 w-16 mx-auto mb-3 rounded-[20px] bg-ios-green/10 text-ios-green flex items-center justify-center"><AppIcon name="invest" size={30} /></div>
              <p className="font-bold text-[17px]">یاد بگیر سرمایه‌گذاری کنی</p>
              <p className="secondary text-[14px] mt-1 leading-relaxed px-4">
                مشاور وضعیتِ مالی و هدف‌های خریدت رو می‌بینه و نرخِ امروزِ دلار و طلا رو می‌دونه. درباره‌ی حفظِ ارزشِ پول در فضای ایران ازش بپرس — آموزش می‌ده، نه توصیه‌ی بخر/بفروش.
              </p>
              <div className="flex flex-col gap-2 mt-5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="ios-btn-ghost !py-2.5 !text-[14px] mx-auto">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-7 whitespace-pre-wrap ${
                  m.role === "user" ? "text-white" : "bg-black/[0.05] dark:bg-white/[0.08]"
                }`}
                style={m.role === "user" ? { backgroundImage: "linear-gradient(135deg, #22c391, #19a7c4)" } : undefined}
              >
                {m.content}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-end">
              <div className="rounded-2xl px-4 py-3 bg-black/[0.05] dark:bg-white/[0.08]"><Spinner className="!h-4 !w-4" /></div>
            </div>
          )}
        </div>

        {err && <p className="text-ios-red text-[13px] px-1 pb-1">{err}</p>}

        <div className="shrink-0 flex items-end gap-2 pt-2 border-t border-[var(--sep)]">
          <textarea
            className="ios-input flex-1 min-h-[46px] max-h-[120px] resize-none !py-2.5"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="سؤالت درباره‌ی سرمایه‌گذاری رو بنویس…"
            rows={1}
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="h-[46px] w-[46px] shrink-0 rounded-2xl text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
            style={{ backgroundImage: "linear-gradient(135deg, #22c391, #19a7c4)" }}
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
