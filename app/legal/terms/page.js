export const metadata = {
  title: "利用規約 | MODANICA",
};

export default function TermsPage() {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <h1 className="text-xl font-bold">利用規約</h1>
      <p className="text-black/60">
        本規約は、有限会社アールクラブ（以下「当社」といいます）が運営する「MODANICA」の予約サイト（以下「本サイト」といいます）のご利用条件を定めるものです。
        本サイトをご利用になるお客様（以下「利用者」といいます）は、本規約に同意のうえご利用ください。
      </p>

      <section className="space-y-2">
        <h2 className="font-bold">第1条（適用）</h2>
        <p>
          本規約は、本サイトを通じたカフェ・宿泊・BBQ施設等の予約サービス（以下「本サービス」といいます）の利用に関する当社と利用者との間の一切の関係に適用されます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">第2条（予約の成立）</h2>
        <p>
          本サービスの予約は、利用者が本サイトの予約フォームより必要事項を送信した時点では「仮予約（要確認）」の状態となり、当社が内容を確認し「確定」のステータスに変更した時点、または当社が別途確認のご連絡を行った時点で成立するものとします。
          予約状況によっては、ご希望の日時・内容にて予約が成立しない場合がありますので、あらかじめご了承ください。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">第3条（料金・お支払い）</h2>
        <p>
          本サービスの料金は、本サイトの各プランページに表示する金額によります。Web予約に伴うお支払いはクレジットカード決済とし、現地でのオプション追加等のお支払いは、現金・クレジットカードなど当施設が指定する各種お支払い方法によるものとします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">第4条（キャンセルポリシー）</h2>
        <p>
          利用者のご都合によりご予約をキャンセルされる場合、ご利用日を基準として以下のキャンセル料が発生します。日数の算定には、ご利用日当日を含みません。
        </p>
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden my-2">
          <table className="w-full">
            <thead>
              <tr className="bg-black/5 text-left">
                <th className="px-4 py-2 font-medium">キャンセルのタイミング</th>
                <th className="px-4 py-2 font-medium">キャンセル料</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-black/5">
                <td className="px-4 py-2">ご利用日の8日前まで</td>
                <td className="px-4 py-2">無料</td>
              </tr>
              <tr className="border-t border-black/5">
                <td className="px-4 py-2">ご利用日の7日前〜3日前</td>
                <td className="px-4 py-2">ご利用料金の30%</td>
              </tr>
              <tr className="border-t border-black/5">
                <td className="px-4 py-2">ご利用日の2日前〜前日</td>
                <td className="px-4 py-2">ご利用料金の50%</td>
              </tr>
              <tr className="border-t border-black/5">
                <td className="px-4 py-2">ご利用当日</td>
                <td className="px-4 py-2">ご利用料金の100%</td>
              </tr>
              <tr className="border-t border-black/5">
                <td className="px-4 py-2">ご連絡のないキャンセル（無断キャンセル）</td>
                <td className="px-4 py-2">ご利用料金の100%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          台風・大雪等の天災その他やむを得ない事由により本サービスの提供が困難と当社が判断した場合は、上記キャンセル料は発生せず、代金は全額返金いたします。
        </p>
        <p>
          「確認事項」への同意が必要な予約（優先予約の受付期間中の仮予約）につき、当社の都合により日程変更をお願いする場合、上記キャンセル料は発生せず、次回ご利用時にお使いいただける割引クーポンをご用意いたします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">第5条（禁止事項）</h2>
        <p>
          利用者は、本サービスの利用にあたり、虚偽の情報の登録、当社または第三者の権利・利益を侵害する行為、その他当社が不適切と判断する行為を行ってはならないものとします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">第6条（免責事項）</h2>
        <p>
          当社は、天災地変、通信回線の障害その他当社の責に帰さない事由により本サービスの提供が遅延・中断した場合について、一切の責任を負わないものとします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">第7条（個人情報の取り扱い）</h2>
        <p>
          当社は、利用者の個人情報を別途定める「プライバシーポリシー」に従い適切に取り扱います。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">第8条（規約の変更）</h2>
        <p>
          当社は、必要と判断した場合には、利用者への事前の通知なく本規約を変更することができるものとします。変更後の規約は、本サイトに掲載した時点より効力を生じるものとします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">第9条（準拠法・管轄裁判所）</h2>
        <p>
          本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。
        </p>
      </section>

      <p className="text-black/40 text-xs">制定日：2026年7月30日</p>
    </div>
  );
}
