"use client";

import { useEffect, useState } from "react";

// PAY.JP（API v2）の決済後に戻ってくるページ。
// URL: /payment/return?t=<暗号化されたお申込み内容>&payment_flow_id=...&payment_flow_client_secret=...
// サーバー側で決済の成否・金額を確認し、問題なければ予約を作成して完了ページへ移動する。
export default function PaymentReturnPage() {
  const [state, setState] = useState({ phase: "checking", message: "" });

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams(window.location.search);
    const token = query.get("t");
    const paymentFlowId = query.get("payment_flow_id");

    if (!token || !paymentFlowId) {
      setState({ phase: "error", message: "お支払い情報を確認できませんでした。お手数ですが最初からやり直してください。" });
      return;
    }

    async function finalize(attempt) {
      try {
        const res = await fetch("/api/payments/v2/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, paymentFlowId }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.reservationId) {
          window.location.replace(`/complete/${data.reservationId}`);
          return;
        }
        if (res.status === 202 && attempt < 20) {
          // PayPayの承認反映待ちなど：数秒おいて再確認する。
          setTimeout(() => finalize(attempt + 1), 3000);
          return;
        }
        setState({
          phase: "error",
          message: data.message || "ご予約を完了できませんでした。お支払いが完了している場合は、店舗までご連絡ください。",
        });
      } catch (e) {
        if (!cancelled) {
          setState({ phase: "error", message: "通信に失敗しました。このページを再読み込みしてください。（二重にお支払いが発生することはありません）" });
        }
      }
    }

    finalize(0);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-xl mx-auto rounded-2xl bg-white p-8 shadow-sm space-y-4 text-center">
      {state.phase === "checking" ? (
        <>
          <h1 className="text-lg font-bold">お支払いを確認しています…</h1>
          <p className="text-sm text-black/50">そのままお待ちください。画面を閉じないでください。</p>
        </>
      ) : (
        <>
          <h1 className="text-lg font-bold">ご予約を完了できませんでした</h1>
          <p className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3 whitespace-pre-wrap">{state.message}</p>
          <a href="/" className="inline-block text-sm underline text-black/60">トップへ戻る</a>
        </>
      )}
    </div>
  );
}
