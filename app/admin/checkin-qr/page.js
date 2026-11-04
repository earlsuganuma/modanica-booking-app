"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import AdminNav from "../../../components/AdminNav";

// 宿泊者名簿フォーム（/checkin）のURLとQRコード。Booking.com等のメッセージの定型文に貼るURL、
// 現地で、お客様にスマホで読み取ってもらうQRコード（印刷用）。
export default function CheckinQrPage() {
  const [url, setUrl] = useState("");
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const u = `${window.location.origin}/checkin`;
    setUrl(u);
    QRCode.toString(u, { type: "svg", margin: 1, width: 260 }, (err, out) => {
      if (!err) setSvg(out);
    });
  }, []);

  const template = `ご予約ありがとうございます。旅館業法により、ご宿泊前に宿泊者名簿のご記入をお願いしております。
お手数ですが、ご到着前に、下記のフォームからご記入ください（1分ほどで完了します）。
${url}

Thank you for your reservation. We are required by law to keep a guest register.
Please fill in this form before your arrival (it takes about a minute).
${url}`;

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      alert("コピーできませんでした。手動で選択してコピーしてください。");
    }
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      <h1 className="text-xl font-bold">宿泊者名簿フォーム（OTAのお客様用）</h1>

      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3 text-sm">
        <div className="font-bold">フォームのURL</div>
        <div className="break-all font-mono text-xs">{url}</div>
        <button onClick={() => copy(url)} className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5">
          {copied ? "コピーしました" : "URLをコピー"}
        </button>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3 text-sm">
        <div className="font-bold">現地用のQRコード（印刷して受付に置く）</div>
        <p className="text-xs text-black/50">チェックイン時に、まだ名簿を記入していないお客様に、スマホで読み取ってもらいます。</p>
        {svg ? <div className="inline-block bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="text-xs text-black/40">作成中…</p>}
        <div>
          <button onClick={() => window.print()} className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5">
            このページを印刷
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3 text-sm">
        <div className="font-bold">Booking.comのメッセージ（定型文・自動返信）に貼る文面</div>
        <pre className="whitespace-pre-wrap text-xs bg-black/5 rounded-lg p-3">{template}</pre>
        <button onClick={() => copy(template)} className="text-xs rounded-full border border-black/20 px-4 py-1.5 hover:bg-black/5">
          {copied ? "コピーしました" : "文面をコピー"}
        </button>
      </div>
    </div>
  );
}
