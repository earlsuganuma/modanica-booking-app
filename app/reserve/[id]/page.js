const { getPlan } = require("../../../lib/plans");
import { notFound } from "next/navigation";
import ReserveForm from "../../../components/ReserveForm";

export const dynamic = "force-dynamic";

export default async function ReservePage({ params }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) return notFound();

  return (
    <div className="space-y-6">
      <div className="text-xs text-black/40">
        <a href={`/plans/${plan.id}`} className="hover:underline">{plan.name}</a> / ご予約
      </div>
      <h1 className="text-xl font-bold">{plan.name} のご予約</h1>
      {plan.description && (
        <p className="text-sm text-black/70 leading-relaxed whitespace-pre-wrap">{plan.description}</p>
      )}
      <ReserveForm plan={plan} />
    </div>
  );
}
