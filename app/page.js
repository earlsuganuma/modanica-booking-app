export default function TopPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">MODANICAへようこそ</h1>
        <p className="text-black/60 leading-relaxed">
          カフェ利用・宿泊・BBQのご予約はこちらから。ご利用シーンに合わせて「施設利用」「カフェ」からお選びください。
        </p>
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        <a
          href="/plans/facility"
          className="block rounded-2xl bg-ink text-white p-6 shadow-sm hover:opacity-90 transition"
        >
          <div className="text-sm text-white/60 mb-1">宿泊・BBQ貸切</div>
          <div className="text-lg font-bold">施設利用プラン一覧</div>
        </a>
        <a
          href="/plans/cafe"
          className="block rounded-2xl bg-white border border-black/10 p-6 shadow-sm hover:bg-black/5 transition"
        >
          <div className="text-sm text-black/50 mb-1">飲食・カフェ利用</div>
          <div className="text-lg font-bold">カフェ系プラン一覧</div>
        </a>
      </div>
    </div>
  );
}
