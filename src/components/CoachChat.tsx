"use client";

import { useEffect, useRef, useState } from "react";
import { apiSend, ApiError } from "@/lib/client";
import { Sheet, Spinner } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import { AiError } from "@/components/AiError";

type Saved = { type: string; label: string };
type Msg = { role: "user" | "assistant"; content: string; saved?: Saved[]; image?: string };

const SUGGESTIONS = [
  "می‌خوام منظم‌تر بشم",
  "می‌خوام لاغر شم",
  "می‌خوام پس‌انداز کنم",
];

/** عکس را روی حداکثر ۱۰۲۴px کوچک و به JPEG با کیفیتِ متوسط تبدیل می‌کند تا حجمِ آپلود کم بماند. */
async function fileToCompressedDataUrl(file: File, max = 1024, quality = 0.7): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("خطا در خواندن عکس."));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("عکس نامعتبر است."));
    el.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export default function CoachChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  async function send(text: string, image?: string) {
    const content = text.trim() || (image ? "این عکسِ غذامه، کالریش رو ثبت کن." : "");
    if ((!content && !image) || busy) return;
    setErr(null);
    const userMsg: Msg = { role: "user", content, ...(image ? { image } : {}) };
    const next = [...msgs, userMsg];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      // تصویر جداگانه فرستاده می‌شه؛ تاریخچه فقط متن نگه می‌داره.
      const history = next.map(({ role, content }) => ({ role, content }));
      const { reply, saved } = await apiSend<{ reply: string; saved?: Saved[] }>(
        "/api/coach/chat",
        "POST",
        { messages: history, ...(image ? { image } : {}) }
      );
      setMsgs((m) => [...m, { role: "assistant", content: reply, saved }]);
    } catch (e) {
      setErr(e instanceof ApiError ? e : new Error("خطا در ارتباط با مربی."));
    } finally {
      setBusy(false);
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // اجازه‌ی انتخابِ دوباره‌ی همان فایل
    if (!file || busy) return;
    setErr(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      await send(input, dataUrl);
    } catch (err) {
      setErr(err instanceof ApiError ? err : new Error("خطا در پردازش عکس."));
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="جوانه" fillHeight>
      <div className="flex flex-col flex-1 min-h-0">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 py-2">
          {msgs.length === 0 && !busy && (
            <div className="text-center py-6">
              <div className="h-16 w-16 mx-auto mb-3 rounded-[20px] bg-ios-blue/10 text-ios-blue flex items-center justify-center"><AppIcon name="sprout" size={30} /></div>
              <p className="font-bold text-[17px]">سلام، من جوانه‌ام 🌱</p>
              <p className="secondary text-[14px] mt-1 leading-relaxed px-4">
                این روزها بزرگ‌ترین هدفت چیه؟ بگو تا با هم بشکنیمش به قدم‌های کوچیکِ امروز. حتی می‌تونی بگی چی خوردی یا عکسِ غذات رو بفرستی — خودم ثبتش می‌کنم.
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
                className={`max-w-[82%] rounded-2xl text-[15px] leading-7 whitespace-pre-wrap overflow-hidden ${
                  m.role === "user"
                    ? "text-white"
                    : "bg-white shadow-soft"
                } ${m.image ? "p-1.5" : "px-3.5 py-2.5"}`}
                style={m.role === "user" ? { background: "var(--ink)", borderRadius: "20px 20px 20px 6px" } : { borderRadius: "20px 20px 6px 20px" }}
              >
                {m.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={m.image} alt="عکس غذا" className="rounded-xl max-h-52 w-full object-cover mb-1.5" />
                )}
                {m.content && <span className={m.image ? "block px-2 pb-1" : ""}>{m.content}</span>}
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
              <div className="rounded-2xl px-4 py-3 bg-white shadow-soft"><Spinner className="!h-4 !w-4" /></div>
            </div>
          )}
        </div>

        <AiError error={err} className="px-1 pb-1" />

        <div className="shrink-0 flex items-end gap-2 pt-2 border-t border-[var(--sep)]">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="فرستادن عکس غذا"
            className="h-[46px] w-[46px] shrink-0 rounded-2xl flex items-center justify-center bg-black/[0.05] dark:bg-white/[0.08] text-[var(--blue)] disabled:opacity-40 active:scale-95 transition"
          >
            <AppIcon name="camera" size={22} />
          </button>
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
