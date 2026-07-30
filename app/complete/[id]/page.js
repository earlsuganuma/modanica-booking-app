const { load } = require("../../../lib/store");
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CompletePage({ params }) {
  const { id: idParam } = await params;
  const data = await load();
  const id = Number(idParam);
  const r = data.reservations.find((x) => x.id === id);
  if (!r) return notFound();
  const plan = data.plans.find((p) => p.id === r.planId);

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm space-y-4 text-center">
      <div className="text-4xl">📩</div>
      <h1 className="text-xl font-bold">ご予約を受け付けました</h1>
      <p className="text-black/60 text-sm">
        予約番号 <span className="font-mono font-bold">#{r.id}</span>（{plan ? plan.name : r.planId}）
      </p>
      <p className="text-black/60 text-sm leading-relaxed">
        現在のステータスは「要確認」です。担当者が内容を確認のうえ、
        {r.customerEmail} 宛にご連絡いたします。
      </p>
      <a href="/" className="inline-block text-sm underline text-black/50">トップへ戻る</a>
    </div>
  );
}
