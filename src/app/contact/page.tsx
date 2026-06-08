"use client";

import Link from "next/link";
import { useState } from "react";
import { apiSend, ApiError } from "@/lib/client";
import { Spinner } from "@/components/ui";
import { CATEGORY_LABEL, type TicketCategory } from "@/lib/support";

// زیرمجموعه‌ی پرکاربردِ دسته‌ها برای فرمِ عمومی (بقیه زیر «عمومی» می‌افتند).
const CATEGORIES: TicketCategory[] = [
  "general",
  "payment",
  "refund",
  "subscription",
  "otp",
  "ai_quality",
  "bug",
];

export default function ContactPage() {
  const [category, setCategory] = useState<TicketCategory>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    setErr("");
    if (subject.trim().length < 3) return setErr("یک موضوعِ کوتاه بنویس (حداقل ۳ حرف).");
    if (body.trim().length < 5) return setErr("لطفاً پیامت رو کمی کامل‌تر بنویس.");
    setBusy(true);
    try {
      await apiSend("/api/support/tickets", "POST", { category, subject, body, contact });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setErr("برای ثبتِ تیکت اول وارد شو، بعد دوباره از همین‌جا بفرست.");
      } else {
        setErr(e instanceof ApiError ? e.message : "ثبتِ پیام ناموفق بود. دوباره تلاش کن.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] px-5 pt-[max(24px,env(safe-area-inset-top))] pb-[max(40px,env(safe-area-inset-bottom))]" dir="rtl">
      <div className="max-w-xl mx-auto">
        <header className="mb-6">
          <Link href="/" className="text-ios-blue text-[14px] font-medium active:opacity-60">‹ بازگشت</Link>
          <h1 className="text-[26px] font-extrabold text-[var(--label)] mt-3">تماس با ما</h1>
          <p className="text-[14px] text-[var(--secondary)] mt-1">
            سؤال، مشکل یا درخواستت رو بنویس؛ پیامت به‌صورتِ تیکت ثبت می‌شه و بهش رسیدگی می‌کنیم.
          </p>
        </header>

        {done ? (
          <div className="rounded-3xl bg-[var(--card-solid)] shadow-soft px-5 py-8 text-center">
            <div className="h-14 w-14 mx-auto mb-3 rounded-full bg-ios-green/15 text-ios-green flex items-center justify-center text-[28px]">✓</div>
            <p className="text-[17px] font-bold text-[var(--label)]">تیکتت ثبت شد 🌱</p>
            <p className="text-[14px] text-[var(--secondary)] mt-1 leading-relaxed">
              ممنون که خبرمون کردی. در اولین فرصت بررسی می‌کنیم. پاسخ رو در بخشِ پشتیبانیِ اپ می‌بینی.
            </p>
            <button
              onClick={() => { setDone(false); setSubject(""); setBody(""); setContact(""); }}
              className="ios-btn-ghost mt-5 mx-auto"
            >
              ثبتِ تیکتِ دیگر
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--secondary)] mb-1.5">موضوع</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3.5 py-2 rounded-full text-[13.5px] font-medium transition active:scale-95 ${
                      category === c
                        ? "bg-[var(--ink)] text-white"
                        : "bg-black/[0.05] dark:bg-white/[0.08] text-[var(--secondary)]"
                    }`}
                  >
                    {CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--secondary)] mb-1.5">عنوانِ کوتاه</label>
              <input
                className="ios-input w-full text-right"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثلاً: پرداخت کردم ولی پلن فعال نشد"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--secondary)] mb-1.5">توضیحات</label>
              <textarea
                className="ios-input w-full min-h-[140px] resize-none !py-3 text-right"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="چی شده؟ هرچی لازمه بدونیم بنویس — برای پرداخت، شماره تراکنش رو هم بذار."
                maxLength={5000}
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--secondary)] mb-1.5">
                راهِ ارتباط برای پاسخ <span className="text-[var(--secondary)]/70">(اختیاری)</span>
              </label>
              <input
                className="ios-input w-full text-right"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="شماره، ایمیل یا آیدی تلگرام"
              />
              <p className="text-[12px] text-[var(--secondary)] mt-1.5 leading-5">
                اگر واردِ حسابت شده باشی، تیکت به همون حساب وصل می‌شه و پاسخ رو در اپ می‌بینی.
              </p>
            </div>

            {err && <p className="text-ios-red text-[13px] text-center">{err}</p>}

            <button
              onClick={submit}
              disabled={busy}
              className="w-full h-14 rounded-full text-white text-[16px] font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition disabled:opacity-50"
              style={{ background: "var(--ink)", boxShadow: "0 14px 28px -14px rgba(20,22,30,0.6)" }}
            >
              {busy ? <Spinner /> : "ثبتِ تیکت"}
            </button>

            <p className="text-center text-[12px] text-[var(--secondary)] pt-1">
              <Link href="/legal" className="text-ios-blue">قوانین و حریم خصوصی</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
