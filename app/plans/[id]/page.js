const { getPlan } = require("../../../lib/plans");
import { notFound } from "next/navigation";
import PlanImageSlideshow from "../../../components/PlanImageSlideshow";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL = { facility: "施設利用", cafe: "カフェ" };
const CONFIRMATION_LABEL = { manual: "要確認（担当者確認後に確定）", auto: "自動確定" };

export default async function PlanDetailPage({ params }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) return notFound();

  const manualDefault = plan.confirmationRules.find((r) => r.day_type === "all")?.confirmation_type || "manual";

  return (
    <div className="space-y-6">
      <div className="text-xs text-black/40">
        <a href={`/plans/${plan.category}`} className="hover:underline">
          {CATEGORY_LABEL[plan.category]}プラン一覧
        </a>{" "}
        / #{plan.code}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        {plan.images && plan.images.length > 0 && <PlanImageSlideshow images={plan.images} />}

        <h1 className="text-2xl font-bold">{plan.name}</h1>
        <p className="text-black/70 leading-relaxed">{plan.description}</p>

        <dl className="grid sm:grid-cols-2 gap-4 text-sm border-t border-black/10 pt-4">
          <div>
            <dt className="text-black/40">対象人数</dt>
            <dd className="font-medium">{plan.min_guests}〜{plan.max_guests}名</dd>
          </div>
          <div>
            <dt className="text-black/40">対象リソース</dt>
            <dd className="font-medium">{plan.resources.map((r) => r.name).join(" / ")}</dd>
          </div>
          <div>
            <dt className="text-black/40">料金目安</dt>
            <dd className="font-medium">¥{plan.base_price.toLocaleString()}〜（曜日により変動）</dd>
          </div>
          <div>
            <dt className="text-black/40">確定方式</dt>
            <dd className="font-medium">{CONFIRMATION_LABEL[manualDefault]}</dd>
          </div>
        </dl>

        {plan.options.length > 0 && (
          <div className="border-t border-black/10 pt-4">
            <div className="text-black/40 text-sm mb-2">選択可能オプション</div>
            <ul className="text-sm space-y-2">
              {plan.options.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    {o.imageUrl && (
                      <img
                        src={o.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    {o.name}{o.is_default ? "（デフォルト）" : ""}
                  </span>
                  <span className="flex-shrink-0">{o.price ? `+¥${o.price.toLocaleString()}` : "無料"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-black/10 pt-4">
          <a
            href={`/reserve/${plan.id}`}
            className="inline-block rounded-full bg-ink text-white px-6 py-3 text-sm font-semibold hover:opacity-90"
          >
            このプランに申し込む
          </a>
        </div>
      </div>
    </div>
  );
}
