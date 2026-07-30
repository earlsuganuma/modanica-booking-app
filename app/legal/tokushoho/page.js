export const metadata = {
  title: "特定商取引法に基づく表記 | MODANICA",
};

const ROWS = [
  ["販売事業者名", "有限会社アールクラブ"],
  ["運営統括責任者", "菅沼 仁志"],
  ["所在地", "〒389-0405 長野県東御市和1093-2"],
  ["電話番号", "090-6507-9790"],
  ["メールアドレス", "kanri@modanica.net"],
  ["販売価格", "各プラン・オプションのご案内ページに表示する価格によります。"],
  [
    "商品代金以外の必要料金",
    "ご予約内容に応じて、オプション追加料金・繁忙期料金等が別途発生する場合があります。詳細は各プランページをご確認ください。",
  ],
  [
    "お支払い方法",
    "Web予約：クレジットカード決済\n現地でのオプション追加等：現金・クレジットカードなど、当施設が指定する各種お支払い方法",
  ],
  [
    "お支払い時期",
    "Web予約：ご予約確定時にクレジットカードにて決済\n現地でのオプション追加分：ご利用当日、現地にてお支払い",
  ],
  ["サービスの提供時期", "ご予約いただいた利用日時にご提供します。"],
  [
    "キャンセル・返金について",
    "「利用規約」内のキャンセルポリシーをご確認ください。",
  ],
  [
    "動作環境",
    "インターネットに接続されたパソコン・スマートフォン等の一般的なWebブラウザでご利用いただけます。",
  ],
];

export default function TokushohoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">特定商取引法に基づく表記</h1>
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {ROWS.map(([label, value]) => (
              <tr key={label} className="border-b border-black/5 last:border-0">
                <th className="align-top text-left font-medium text-black/50 w-40 sm:w-48 px-4 py-3 whitespace-nowrap">
                  {label}
                </th>
                <td className="px-4 py-3 whitespace-pre-wrap">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
