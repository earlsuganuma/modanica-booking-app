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

function baseInfoLines(reservation, plan) {
  return [
    `予約番号：#${reservation.id}`,
    `プラン：${plan ? plan.name : reservation.planId}`,
    `日時：${formatRange(reservation.startDatetime, reservation.endDatetime)}`,
    `人数：${reservation.guestCount}名`,
    `金額目安：¥${reservation.totalPrice.toLocaleString()}`,
  ].join("\n");
}

function reservationReceived(reservation, plan) {
  const subject = `【MODANICA】ご予約を受け付けました（要確認）#${reservation.id}`;
  const text = `${reservation.customerName} 様

この度はMODANICAにご予約いただき、誠にありがとうございます。
以下の内容でご予約を受け付けました。担当者が内容を確認のうえ、確定のご連絡をいたします。

${baseInfoLines(reservation, plan)}

現在のステータス：要確認（内容確認後に確定のご連絡をいたします）

ご不明な点がございましたら、本メールへの返信にてお気軽にお問い合わせください。
今後ともよろしくお願いいたします。

MODANICA`;
  return { subject, text };
}

function reservationConfirmed(reservation, plan) {
  const subject = `【MODANICA】ご予約が確定しました #${reservation.id}`;
  const text = `${reservation.customerName} 様

以下のご予約が確定いたしましたのでご連絡いたします。

${baseInfoLines(reservation, plan)}

当日のお越しをスタッフ一同心よりお待ちしております。
ご不明な点がございましたら、本メールへの返信にてお気軽にお問い合わせください。

MODANICA`;
  return { subject, text };
}

function reservationCancelled(reservation, plan) {
  const subject = `【MODANICA】ご予約キャンセルのお知らせ #${reservation.id}`;
  const text = `${reservation.customerName} 様

以下のご予約はキャンセルとなりましたのでご連絡いたします。

${baseInfoLines(reservation, plan)}

またのご利用を心よりお待ちしております。ご不明な点がございましたら本メールへの返信にてお問い合わせください。

MODANICA`;
  return { subject, text };
}

function adminNewReservationNotice(reservation, plan) {
  const subject = `【MODANICA管理】新しい予約が入りました #${reservation.id}`;
  const text = `新しいご予約が入りました。管理画面から内容をご確認ください。

${baseInfoLines(reservation, plan)}
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
