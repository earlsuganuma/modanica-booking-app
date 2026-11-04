"use client";

import { useEffect, useState } from "react";

const inputCls = "mt-1 w-full rounded-lg border border-black/15 px-3 py-2";

// 宿泊者名簿のご記入フォーム（日本語＋英語の併記）。
export default function CheckinForm() {
  const [form, setForm] = useState({
    checkIn: "",
    guestName: "",
    address: "",
    tel: "",
    email: "",
    guestMale: 0,
    guestFemale: 0,
    guestChildren: 0,
    arrivalTime: "",
    isForeign: false,
    nationality: "",
    passportNo: "",
    bookingRef: "",
    note: "",
    website: "", // ボット対策のおとり欄
    agree: false,
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // ?date=2026-11-07&ref=5873912097 のようなURLで、チェックイン日・予約番号を先に入れておける
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const date = p.get("date");
    const ref = p.get("ref");
    setForm((f) => ({
      ...f,
      checkIn: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : f.checkIn,
      bookingRef: ref ? ref.replace(/\D/g, "") : f.bookingRef,
    }));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const total = (Number(form.guestMale) || 0) + (Number(form.guestFemale) || 0) + (Number(form.guestChildren) || 0);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/guest-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          nationality: form.isForeign ? form.nationality : "日本",
          passportNo: form.isForeign ? form.passportNo : "",
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.message || "送信に失敗しました。 / Failed to submit.");
      } else {
        setDone(true);
        window.scrollTo(0, 0);
      }
    } catch (err) {
      setError("通信に失敗しました。電波の良い場所で、もう一度お試しください。 / Network error. Please try again.");
    }
    setSending(false);
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
        <h1 className="text-xl font-bold">ご記入ありがとうございました</h1>
        <p className="text-sm text-black/70">Thank you. Your registration has been received.</p>
        <p className="text-sm text-black/60">
          当日のお越しを、スタッフ一同お待ちしております。
          <br />
          We look forward to welcoming you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold">宿泊者名簿のご記入</h1>
        <p className="text-sm text-black/60">
          旅館業法により、ご宿泊の際は、宿泊者名簿へのご記入が必要です。ご到着前に、こちらからご記入ください。
          <br />
          <span className="text-black/50">
            Under Japanese law, we are required to keep a guest register. Please fill in this form before your arrival.
          </span>
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <label className="block text-sm">
          <span className="text-black/50">チェックイン日 / Check-in date</span>
          <input type="date" required value={form.checkIn} onChange={set("checkIn")} className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="text-black/50">代表者のお名前 / Name (lead guest)</span>
          <input required value={form.guestName} onChange={set("guestName")} className={inputCls} autoComplete="name" />
          <span className="text-xs text-black/40">ご予約時のお名前と同じ表記でご入力ください。 / Please use the same spelling as your booking.</span>
        </label>
        <label className="block text-sm">
          <span className="text-black/50">ご住所 / Address</span>
          <input required value={form.address} onChange={set("address")} className={inputCls} autoComplete="street-address" />
        </label>
        <label className="block text-sm">
          <span className="text-black/50">電話番号 / Phone number</span>
          <input required type="tel" value={form.tel} onChange={set("tel")} className={inputCls} autoComplete="tel" />
        </label>
        <label className="block text-sm">
          <span className="text-black/50">メールアドレス（任意）/ Email (optional)</span>
          <input type="email" value={form.email} onChange={set("email")} className={inputCls} autoComplete="email" />
        </label>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
        <div className="text-sm text-black/50">ご宿泊の人数 / Number of guests</div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="text-black/40 text-xs">男性 / Male</span>
            <input type="number" min="0" value={form.guestMale} onChange={set("guestMale")} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-black/40 text-xs">女性 / Female</span>
            <input type="number" min="0" value={form.guestFemale} onChange={set("guestFemale")} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-black/40 text-xs">子供（4〜12歳）/ Child</span>
            <input type="number" min="0" value={form.guestChildren} onChange={set("guestChildren")} className={inputCls} />
          </label>
        </div>
        <p className="text-xs text-black/40">合計 / Total：{total}</p>
        <label className="block text-sm">
          <span className="text-black/50">到着予定時刻（任意）/ Estimated arrival time (optional)</span>
          <input value={form.arrivalTime} onChange={set("arrivalTime")} className={inputCls} placeholder="17:00" />
        </label>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isForeign} onChange={set("isForeign")} />
          <span>日本国内に住所のない外国の方 / I live outside Japan</span>
        </label>
        {form.isForeign && (
          <>
            <label className="block text-sm">
              <span className="text-black/50">国籍 / Nationality</span>
              <input required value={form.nationality} onChange={set("nationality")} className={inputCls} />
            </label>
            <label className="block text-sm">
              <span className="text-black/50">パスポート番号 / Passport number</span>
              <input required value={form.passportNo} onChange={set("passportNo")} className={inputCls} />
              <span className="text-xs text-black/40">チェックイン時に、パスポートを確認させていただきます。 / We will check your passport at check-in.</span>
            </label>
          </>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <label className="block text-sm">
          <span className="text-black/50">ご予約番号（分かる場合のみ）/ Booking number (if known)</span>
          <input inputMode="numeric" value={form.bookingRef} onChange={set("bookingRef")} className={inputCls} />
          <span className="text-xs text-black/40">予約確認メールに記載されています。 / Shown in your booking confirmation.</span>
        </label>
        <label className="block text-sm">
          <span className="text-black/50">ご要望・備考（任意）/ Notes (optional)</span>
          <textarea rows={3} value={form.note} onChange={set("note")} className={inputCls} />
        </label>
        {/* ボット対策のおとり欄（人間には見えない） */}
        <div style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }} aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
          </label>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={form.agree} onChange={set("agree")} className="mt-1" />
          <span>
            ご記入いただいた内容は、宿泊者名簿の作成・保管（旅館業法に基づく）と、ご宿泊に関するご連絡のために利用します。
            <a href="/legal/privacy" target="_blank" className="underline" rel="noopener noreferrer">プライバシーポリシー</a>
            に同意します。
            <span className="block text-xs text-black/40">
              I agree that my information will be used for the guest register required by law and for communication about my stay.
            </span>
          </span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={sending || !form.agree || total < 1}
          className="w-full rounded-full bg-ink text-white py-3 text-sm hover:opacity-90 disabled:opacity-40"
        >
          {sending ? "送信中… / Sending…" : "送信する / Submit"}
        </button>
      </div>
    </form>
  );
}
