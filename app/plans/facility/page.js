const { listPlans } = require("../../../lib/plans");
import PlanCard from "../../../components/PlanCard";

export const dynamic = "force-dynamic";

export default async function FacilityPlansPage() {
  const plans = await listPlans("facility");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">施設利用プラン</h1>
        <p className="text-sm text-black/50 mt-1">宿泊・BBQ貸切など、施設をご利用いただくプランです。</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </div>
    </div>
  );
}
