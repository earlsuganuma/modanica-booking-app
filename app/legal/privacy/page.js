export const metadata = {
  title: "プライバシーポリシー | MODANICA",
};

export default function PrivacyPage() {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <h1 className="text-xl font-bold">プライバシーポリシー</h1>
      <p className="text-black/60">
        有限会社アールクラブ（以下「当社」といいます）は、当社が運営する「MODANICA」の予約サイト（以下「本サイト」といいます）における利用者の個人情報の取り扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
      </p>

      <section className="space-y-2">
        <h2 className="font-bold">1. 取得する情報</h2>
        <p>
          当社は、本サイトのご予約フォームを通じて、お名前、メールアドレス、電話番号、ご予約内容、ご要望・備考等の情報を取得します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">2. 利用目的</h2>
        <p>取得した個人情報は、以下の目的のために利用します。</p>
        <p>
          ・ご予約の確認・確定・変更・キャンセル対応のため
          <br />
          ・ご予約内容に関するご連絡（確認メール・リマインド等）のため
          <br />
          ・お支払い・決済処理のため
          <br />
          ・お問い合わせへの対応のため
          <br />
          ・本サービスの改善・不正利用防止のため
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">3. 第三者提供</h2>
        <p>
          当社は、法令に基づく場合を除き、利用者の同意なく個人情報を第三者に提供することはありません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">4. 業務委託先への提供</h2>
        <p>
          当社は、本サービスの提供にあたり、以下の業務委託先に必要な範囲で個人情報を取り扱わせることがあります。委託先においても適切な安全管理措置が講じられます。
        </p>
        <p>
          ・メール配信サービス（ご予約確認メール等の送信のため）
          <br />
          ・決済代行サービス（クレジットカード決済処理のため）
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">5. 個人情報の管理</h2>
        <p>
          当社は、取得した個人情報を正確かつ最新の内容に保つよう努め、不正アクセス・紛失・破壊・改ざん・漏えい等を防止するため、適切な安全管理措置を講じます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">6. 開示・訂正・削除等のご請求</h2>
        <p>
          利用者は、当社が保有する自己の個人情報について、開示、訂正、削除等を求めることができます。ご希望の場合は、下記お問い合わせ窓口までご連絡ください。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">7. お問い合わせ窓口</h2>
        <p>
          有限会社アールクラブ
          <br />
          運営統括責任者：菅沼 仁志
          <br />
          所在地：〒389-0405 長野県東御市和1093-2
          <br />
          電話番号：090-6507-9790
          <br />
          メールアドレス：kanri@modanica.net
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">8. 本ポリシーの変更</h2>
        <p>
          当社は、必要に応じて本ポリシーの内容を変更することがあります。変更後の内容は、本サイトに掲載した時点より効力を生じるものとします。
        </p>
      </section>

      <p className="text-black/40 text-xs">制定日：2026年7月30日</p>
    </div>
  );
}
