"use client";

import { useState } from "react";
import { apiSend, ApiError } from "@/lib/client";
import { Sheet, Spinner } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import { AiError } from "@/components/AiError";

type Saved = { type: string; label: string };

const EXAMPLES = [
  "نهار: زرشک‌پلو با مرغ",
  "۸۰ تومن نهار خوردم",
  "دو لیوان آب",
  "وزنم شد ۷۴",
];

export default function QuickCapture({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [note, setNote] = useState("");

  function reset() {
    setText("");
    setErr(null);
    setSaved([]);
    setNote("");
  }

  async function submit(value: string) {
    const content = value.trim();
    if (!content || busy) return;
    setErr(null);
    setSaved([]);
    setNote("");
    setBusy(true);
    try {
      const res = await apiSend<{ saved: Saved[]; note?: string }>("/api/coach/parse", "POST", { text: content });
      setSaved(res.saved || []);
      setNote(res.note || "");
      if (res.saved?.length) {
        setText("");
        onSaved?.();
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e : new Error("ثبت نشد، دوباره امتحان کن."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="ثبتِ سریع"
    >
      <p className="secondary text-[14px] leading-relaxed mb-3">
        هرچی خوردی، خرج کردی یا اندازه گرفتی رو با زبونِ خودت بنویس — خودم می‌فهمم و ثبتش می‌کنم.
      </p>

      <textarea
        className="ios-input w-full min-h-[88px] max-h-[180px] resize-none !py-3"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit(text);
          }
        }}
        placeholder="مثلاً: نهار کوبیده با برنج و یه دوغ، بعدش ۱۲۰ تومن تاکسی"
        autoFocus
      />

      <div className="flex flex-wrap gap-2 mt-3">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setText(ex)}
            className="chip !text-[13px] active:opacity-60 transition"
          >
            {ex}
          </button>
        ))}
      </div>

      <AiError error={err} className="mt-3" />

      {saved.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[14px] font-bold text-ios-green flex items-center gap-1.5"><AppIcon name="check" size={16} /> ثبت شد</p>
          {saved.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] px-3.5 py-2.5 animate-scale-in"
            >
              <span className="text-ios-blue shrink-0"><AppIcon name={s.type} size={20} /></span>
              <span className="text-[15px]">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {note && saved.length === 0 && !err && (
        <p className="secondary text-[14px] mt-3 leading-relaxed">{note}</p>
      )}

      <button
        onClick={() => submit(text)}
        disabled={busy || !text.trim()}
        className="ios-btn-primary w-full mt-5 flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {busy && <Spinner />} {busy ? "در حالِ فهمیدن…" : "ثبت کن"}
      </button>
    </Sheet>
  );
}
