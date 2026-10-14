import AdminNav from "../../../../components/AdminNav";
import ReserveForm from "../../../../components/ReserveForm";
const { listPlans, getPlan } = require("../../../../lib/plans");

export const dynamic = "force-dynamic";

// 管理画面からの予約登録（電話予約・店頭受付など）。
// お客様用の予約フォームを「管理者モード」で再利用する（決済なし・確認メールなし・メール任意）。
export default async function AdminNewReservationPage({ searchParams }) {
  const { plan: planId } = await searchParams;
  const plans = await listPlans();
  const plan = planId ? await getPlan(planId) : null;

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="text-xs text-black/40">
        <a href="/admin/reservations" className="hover:underline">予約一覧</a> / 予約を登録（電話・店頭）
      </div>
      <h1 className="text-xl font-bold">予約を登録（電話・店頭）</h1>

      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-2">
        <h2 className="font-bold text-sm">プランを選択</h2>
        <form method="get" className="flex flex-wrap gap-2 items-center">
          <select name="plan" defaultValue={planId || ""} className="rounded-lg border border-black/15 px-3 py-2 text-sm">
            <option value="">選択してください</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="text-sm rounded-full bg-ink text-white px-5 py-2 hover:opacity-90">
            このプランで入力する
          </button>
        </form>
      </div>

      {plan && <ReserveForm key={plan.id} plan={plan} adminMode />}
    </div>
  );
}
