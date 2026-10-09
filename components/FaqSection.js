import { toSafeHtml } from "../lib/safeHtml";

// よくある質問（折りたたみ表示）。Q&Aが0件のときは何も表示しない。
export default function FaqSection({ faqs, title = "よくあるご質問" }) {
  if (!faqs || faqs.length === 0) return null;
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
      <h2 className="font-bold">{title}</h2>
      <div className="divide-y divide-black/10">
        {faqs.map((f) => (
          <details key={f.id} className="group py-3">
            <summary className="cursor-pointer list-none flex items-start justify-between gap-3 text-sm font-medium">
              <span>
                <span className="text-black/40 mr-2">Q.</span>
                {f.question}
              </span>
              <span className="text-black/30 group-open:rotate-45 transition-transform flex-shrink-0">＋</span>
            </summary>
            <div className="mt-2 text-sm text-black/70 leading-relaxed whitespace-pre-wrap">
              <span className="text-black/40 mr-2">A.</span>
              {/* 回答は管理者入力。許可タグ（a/br/strong/b/em/i）とURL自動リンクのみ有効にして出力する */}
              <span dangerouslySetInnerHTML={{ __html: toSafeHtml(f.answer) }} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
