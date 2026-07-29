export default function PlanCard({ plan }) {
  return (
    <a
      href={`/plans/${plan.id}`}
      className="block rounded-2xl bg-white border border-black/10 p-5 shadow-sm hover:shadow-md transition"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-black/40">#{plan.code}</span>
        <span className="text-xs text-black/40">{plan.min_guests}〜{plan.max_guests}名</span>
      </div>
      <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
      <p className="text-sm text-black/60 line-clamp-2">{plan.description}</p>
      <div className="mt-3 text-sm font-semibold text-ink">
        ¥{plan.base_price.toLocaleString()}〜
      </div>
    </a>
  );
}
