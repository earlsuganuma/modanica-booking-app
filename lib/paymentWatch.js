// 決済の「取りこぼし」を早期に見つけるための毎日のチェック（運営者へメール通知）。
//
// チェック1：与信（仮売上）のまま、管理画面で「確定」されていない予約
//   カードの仮売上には期限がある（国内カードは通常7日。超えると売上確定できない）。
//   受付から WARN_DAYS 日以上たっても未確定の予約を知らせる。
// チェック2：PAY.JP上は決済が完了している（仮売上・売上確定）のに、サイトに予約がない決済
//   決済後にお客様がブラウザを閉じた等で、予約が作られなかったケース。
//   特に PayPay は売上が確定済みのため、返金（または予約の手動登録）が必要になる。
//
// 何も問題がなければメールは送らない。

const { load } = require("./store");
const payjpV2 = require("./payjpV2Client");
const { sendMail, ADMIN_NOTIFY_EMAIL } = require("./mailer");

const WARN_DAYS = 4; // 与信のまま未確定の警告を出す日数（受付から）
const URGENT_DAYS = 6; // 期限切れが目前（国内カードの仮売上は7日）
const GRACE_MINUTES = 30; // 決済直後（戻りページで予約作成中）の決済は対象にしない
const LOOKBACK_DAYS = 14; // これより古い決済は見ない

function toDate(v) {
  if (!v) return null;
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function yen(n) {
  return `¥${Number(n || 0).toLocaleString()}`;
}

async function runPaymentWatch({ now = new Date(), notify = true } = {}) {
  const data = await load();
  const since = process.env.PAYMENT_WATCH_SINCE ? toDate(process.env.PAYMENT_WATCH_SINCE) : null;
  const stale = []; // 与信のまま未確定
  const orphans = []; // 予約のない決済
  let listError = null;

  // チェック1
  for (const r of data.reservations) {
    if (r.status === "cancelled" || r.paymentStatus !== "authorized") continue;
    const created = toDate(r.createdAt);
    if (!created) continue;
    const days = Math.floor((now - created) / 86400000);
    if (days >= WARN_DAYS) {
      stale.push({ id: r.id, name: r.customerName, amount: r.paymentAmount || r.totalPrice, days, urgent: days >= URGENT_DAYS });
    }
  }

  // チェック2（API v2 を使っている場合のみ）
  if (payjpV2.isV2Enabled()) {
    try {
      const flows = await payjpV2.listPaymentFlows({ limit: 100 });
      const known = new Set(data.reservations.map((r) => r.payjpChargeId).filter(Boolean));
      for (const f of flows) {
        if (!f || !f.id || known.has(f.id)) continue;
        if (!(f.status === "succeeded" || f.status === "requires_capture")) continue;
        const created = toDate(f.created_at || f.created);
        if (!created) continue;
        const ageMin = (now - created) / 60000;
        if (ageMin < GRACE_MINUTES || ageMin > LOOKBACK_DAYS * 1440) continue;
        // 環境変数 PAYMENT_WATCH_SINCE（例：2026-10-21T00:00:00+09:00）より前の決済は見ない。
        // テスト決済・テスト予約を削除したあとに、過去の決済を「予約のない決済」と誤検知しないための設定。
        if (since && created < since) continue;
        const types = f.payment_method_types || [];
        const method = types.includes("paypay") ? "PayPay" : "カード";
        const meta = f.metadata || {};
        orphans.push({
          id: f.id,
          method,
          status: f.status,
          amount: f.amount,
          created,
          planId: meta.planId || "",
          date: meta.date || "",
          email: meta.customerEmail || "",
        });
      }
    } catch (e) {
      listError = (e && e.message) || String(e);
      console.error("[paymentWatch] list failed:", listError);
    }
  }

  const hasIssue = stale.length > 0 || orphans.length > 0 || !!listError;
  const result = { stale, orphans, listError, notified: false };
  if (!hasIssue || !notify) return result;

  const lines = ["【MODANICA】決済の確認が必要な項目があります。", ""];
  if (stale.length) {
    lines.push("■ 与信（仮売上）のまま、まだ「確定」されていない予約");
    lines.push("  カードの仮売上は、国内カードで通常7日で期限切れになります。期限を過ぎると売上確定できません。");
    lines.push("  お客様と日程を確認のうえ、管理画面で「確定」または「キャンセル」をしてください。");
    for (const s of stale) {
      lines.push(`  ・予約#${s.id} ${s.name || ""} ${yen(s.amount)}（受付から${s.days}日${s.urgent ? "：期限切れが目前です" : ""}）`);
    }
    lines.push("");
  }
  if (orphans.length) {
    lines.push("■ PAY.JPには決済があるのに、サイトに予約がない決済");
    lines.push("  お客様が支払い後に画面を閉じた等で、予約が作られなかった可能性があります。");
    lines.push("  お客様に連絡して、予約を管理画面から登録するか、PAY.JPの管理画面で返金してください。");
    lines.push("  ※PayPayは売上が確定済みのため、予約を作らない場合は返金が必要です。カードの仮売上は、期限が来ると自動で解放されます。");
    for (const o of orphans) {
      const when = o.created.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      lines.push(
        `  ・${o.id} ${o.method} ${yen(o.amount)}（${o.status === "succeeded" ? "支払い確定済み" : "仮売上"}／${when}）プラン:${o.planId || "-"} 利用日:${o.date || "-"} メール:${o.email || "-"}`
      );
    }
    lines.push("");
  }
  if (listError) {
    lines.push("■ PAY.JPの決済一覧を取得できませんでした（予約のない決済のチェックができていません）");
    lines.push(`  ${listError}`);
    lines.push("");
  }
  lines.push("このメールは、毎日の自動チェックで、問題が見つかったときだけ送信されます。");

  if (ADMIN_NOTIFY_EMAIL) {
    await sendMail({
      type: "payment_alert",
      to: ADMIN_NOTIFY_EMAIL,
      subject: "【MODANICA管理】決済の確認が必要です",
      text: lines.join("\n"),
    });
    result.notified = true;
  }
  return result;
}

module.exports = { runPaymentWatch, WARN_DAYS, URGENT_DAYS };
