const { listPlans } = require("../../../lib/plans");
import PlanCard from "../../../components/PlanCard";
import HeroBanner from "../../../components/HeroBanner";
import FaqSection from "../../../components/FaqSection";
const { listFaqs } = require("../../../lib/faqs");

export const dynamic = "force-dynamic";

export default async function CafePlansPage() {
  const plans = await listPlans("cafe");
  const faqs = await listFaqs("cafe");
  return (
    <div className="space-y-6">
      <HeroBanner />
      <div>
        <h1 className="text-xl font-bold">カフェ系プラン</h1>
        <p className="text-sm text-black/50 mt-1">飲食・カフェ利用に関するプランです。決済は当日、店舗にて承ります。</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </div>
      <FaqSection faqs={faqs} />
    </div>
  );
}
