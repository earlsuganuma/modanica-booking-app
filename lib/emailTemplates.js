function formatDatetime(dt) {
  const [datePart, timePart] = dt.split("T");
  const [y, m, d] = datePart.split("-");
  return `${y}年${Number(m)}月${Number(d)}日 ${timePart}`;
}

function formatRange(start, end) {
  const sd = start.split("T")[0];
  const ed = end.split("T")[0];
  if (sd === ed) {
    return `${formatDatetime(start)}〜${end.split("T")[1]}`;
  }
  return `${formatDatetime(start)} 〜 ${formatDatetime(end)}`;
}

// 選択されたオプションの表示文（例：「BBQセット ×2個、追加ドリンク」）。選択がなければ空文字。
// allOptions：オプションマスタ（data.options）。名前・単位の取得に使う。
function optionsText(reservation, allOptions) {
  const ids = reservation.optionIds || [];
  if (!ids.length) return "";
  const quantities = reservation.optionQuantities || {};
  return ids
    .map((oid) => {
      const o = (allOptions || []).find((x) => x.id === oid);
      if (!o) return oid;
      if (o.unit === "quantity") return `${o.name} ×${quantities[oid] ?? 1}${o.unitLabel || "個"}`;
      return o.name;
    })
    .join("、");
}

function baseInfoLines(reservation, plan, allOptions) {
  const lines = [
    `予約番号：#${reservation.id}`,
    `プラン：${plan ? plan.name : reservation.planId}`,
    `日時：${formatRange(reservation.startDatetime, reservation.endDatetime)}`,
    `人数：${reservation.guestCount}名`,
  ];
  const opts = optionsText(reservation, allOptions);
  if (opts) lines.push(`オプション：${opts}`);
  lines.push(`お支払い金額：¥${reservation.totalPrice.toLocaleString()}`);
  return lines.join("\n");
}

function reservationReceived(reservation, plan, allOptions) {
  const subject = `【MODANICA】ご予約を受け付けました（要確認）#${reservation.id}`;
  const paymentNote =
    reservation.paymentStatus === "authorized"
      ? "\n\nご登録いただいたクレジットカードへの請求はまだ発生しておりません（与信枠の確保のみ）。ご予約確定時に決済が確定し、実際にご請求されます。"
      : "";
  const text = `${reservation.customerName} 様

この度はMODANICAにご予約いただき、誠にありがとうございます。
以下の内容でご予約を受け付けました。担当者が内容を確認のうえ、確定のご連絡をいたします。

${baseInfoLines(reservation, plan, allOptions)}

現在のステータス：要確認（内容確認後に確定のご連絡をいたします）${paymentNote}

ご不明な点がございましたら、本メールへの返信にてお気軽にお問い合わせください。
今後ともよろしくお願いいたします。

MODANICA`;
  return { subject, text };
}

// extraNote：プランごとの追記文（管理画面「確定メール文面」で設定）。空なら何も追加しない。
function reservationConfirmed(reservation, plan, extraNote = "", allOptions) {
  const subject = `【MODANICA】ご予約が確定しました #${reservation.id}`;
  const paymentNote =
    reservation.paymentStatus === "captured"
      ? reservation.cardBrand === "PayPay"
        ? "\n\nPayPayでのお支払いが完了いたしました。"
        : "\n\nご登録いただいたクレジットカードへのお支払いが完了いたしました。"
      : "";
  const extra = extraNote && extraNote.trim() ? `\n\n${extraNote.trim()}` : "";
  const text = `${reservation.customerName} 様

以下のご予約が確定いたしましたのでご連絡いたします。

${baseInfoLines(reservation, plan, allOptions)}${paymentNote}${extra}

当日のお越しをスタッフ一同心よりお待ちしております。
ご不明な点がございましたら、本メールへの返信にてお気軽にお問い合わせください。

MODANICA`;
  return { subject, text };
}

function reservationCancelled(reservation, plan, paymentInfo = {}, allOptions) {
  const subject = `【MODANICA】ご予約キャンセルのお知らせ #${reservation.id}`;
  const { refundedAmount = 0 } = paymentInfo;
  let paymentNote = "";
  if (reservation.paymentStatus === "released") {
    paymentNote = "\n\nご登録いただいたクレジットカードへの請求は発生しておりません。";
  } else if (refundedAmount > 0) {
    paymentNote = `\n\nキャンセルポリシーに基づき、¥${refundedAmount.toLocaleString()}をご登録のクレジットカードへ返金いたしました（カード会社の締め日により反映まで日数がかかる場合がございます）。`;
  } else if (reservation.paymentStatus === "captured" || reservation.paymentStatus === "partially_refunded") {
    paymentNote = "\n\nキャンセルポリシーに基づき、今回は返金の対象外となりますことをご了承ください。";
  }
  const text = `${reservation.customerName} 様

以下のご予約はキャンセルとなりましたのでご連絡いたします。

${baseInfoLines(reservation, plan, allOptions)}${paymentNote}

またのご利用を心よりお待ちしております。ご不明な点がございましたら本メールへの返信にてお問い合わせください。

MODANICA`;
  return { subject, text };
}

function adminNewReservationNotice(reservation, plan, allOptions) {
  const subject = `【MODANICA管理】新しい予約が入りました #${reservation.id}`;
  const text = `新しいご予約が入りました。管理画面から内容をご確認ください。

${baseInfoLines(reservation, plan, allOptions)}
お客様：${reservation.customerName}（${reservation.customerEmail} / ${reservation.customerTel || "電話番号未入力"}）
備考：${reservation.note || "なし"}`;
  return { subject, text };
}

module.exports = {
  reservationReceived,
  reservationConfirmed,
  reservationCancelled,
  adminNewReservationNotice,
  formatRange,
};
