"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TimeAxis from "./TimeAxis";
import { includesMaleGuests } from "../lib/lodging";
import { requiresOnlinePayment } from "../lib/paymentRules";
import { INQUIRY_ONLY_MESSAGE } from "../lib/salesRules";
import { PHONE_DISPLAY, PHONE_TEL, CONTACT_FORM_URL } from "../lib/siteInfo";

// オンライン予約不可の日程の案内（電話番号と、お問い合わせフォームへのリンク付き）
function InquiryNotice() {
  return (
    <>
      この日程はオンライン予約を受け付けておりません。恐れ入りますが、お電話（
      <a href={`tel:${PHONE_TEL}`} className="underline font-bold">
        {PHONE_DISPLAY}
      </a>
      ）または
      <a href={CONTACT_FORM_URL} className="underline font-bold">
        お問い合わせフォーム
      </a>
      からお問い合わせください。
    </>
  );
}
import { computeFlexibleEndTime, flexibleDurationHours } from "../lib/timeTemplates";

const PAYJP_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYJP_PUBLIC_KEY || "";

const SLOT3_OPTIONS = [
  { id: "slot_am", label: "1部（11:00〜16:00）" },
  { id: "slot_pm", label: "2部（17:00〜22:00）" },
  { id: "slot_full", label: "1日（11:00〜22:00）" },
];

function slot3OptionsWithPrice(plan) {
  return SLOT3_OPTIONS.map((s) => {
    const price = plan.slot_prices ? plan.slot_prices[s.id] : null;
    return { ...s, label: price != null ? `${s.label}｜¥${price.toLocaleString()}〜` : s.label };
  });
}

const STAY_TIME_TYPES = ["stay_11_11", "stay_18_11", "stay_16_11"];

export default function ReserveForm({ plan, payjpV2: payjpV2Prop = false, payjpV2PublicKey = "", adminMode = false }) {
  // 決済不要のプラン（当日店頭払い。lib/paymentRules.js）・管理者モードでは、決済の画面と処理を使わない。
  const payOnline = !adminMode && requiresOnlinePayment(plan);
  const payjpV2 = payjpV2Prop && payOnline;
  const slotOptions = slot3OptionsWithPrice(plan);
  const isStayPlan = STAY_TIME_TYPES.includes(plan.time_type);
  const usesV1Card = payOnline && !payjpV2 && !!PAYJP_PUBLIC_KEY;
  // 管理者モード（電話予約など）：決済なし・メール任意・確認事項の同意なし
  const [adminPayMethod, setAdminPayMethod] = useState("onsite");
  const [adminStatus, setAdminStatus] = useState("confirmed");
  const [adminPriceOverride, setAdminPriceOverride] = useState("");
  const showMaleGuests = includesMaleGuests(plan);
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState(SLOT3_OPTIONS[0].id);
  const [nights, setNights] = useState(1);
  const [startTime, setStartTime] = useState("11:00");
  const [guestCount, setGuestCount] = useState(plan.min_guests || 1);
  const [guestMale, setGuestMale] = useState(0);
  const [guestFemale, setGuestFemale] = useState(0);
  const [guestChildren, setGuestChildren] = useState(0);
  const stayGuestTotal = (showMaleGuests ? Number(guestMale) || 0 : 0) + (Number(guestFemale) || 0) + (Number(guestChildren) || 0);
  const [customerAddress, setCustomerAddress] = useState("");
  const [optionIds, setOptionIds] = useState(
    plan.options.filter((o) => o.unit !== "quantity" && o.is_default).map((o) => o.id)
  );
  const [optionQuantities, setOptionQuantities] = useState(
    Object.fromEntries(
      plan.options.filter((o) => o.unit === "quantity" && o.is_default).map((o) => [o.id, 1])
    )
  );
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerTel, setCustomerTel] = useState("");
  const [note, setNote] = useState("");
  const [agreedToPriorityClause, setAgreedToPriorityClause] = useState(false);
  const requiresPriorityClause = plan.category === "cafe" && !adminMode;

  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [paymentStep, setPaymentStep] = useState(null); // null | "authorize" | "3ds" | "finish"

  // PAY.JP カード入力フォーム（payjp.js v2）
  const cardMountRef = useRef(null);
  const payjpRef = useRef(null);
  const cardElementRef = useRef(null);
  const [cardReady, setCardReady] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardBrand, setCardBrand] = useState(null);
  const [cardFormError, setCardFormError] = useState(null);

  // PAY.JP API v2（カード＋PayPay）：入力 →「お支払いへ進む」→ 決済フォーム表示 →「支払って予約する」
  const [payMethod, setPayMethod] = useState("card"); // "card" | "paypay"
  const [phase, setPhase] = useState("form"); // "form" | "pay"
  const [v2Session, setV2Session] = useState(null); // { clientSecret, draftToken, paymentFlowId, total }
  const [widgetsReady, setWidgetsReady] = useState(false);
  const widgetsRef = useRef(null);

  useEffect(() => {
    if (adminMode || !payjpV2 || phase !== "pay" || !v2Session) return;
    let cancelled = false;
    setWidgetsReady(false);

    function mountWidgets() {
      if (cancelled || !window.PayjpPayments) return;
      const payments = window.PayjpPayments(payjpV2PublicKey);
      const widgets = payments.widgets({ clientSecret: v2Session.clientSecret });
      const form = widgets.createForm("payment");
      form.mount("#payjp-payment-form");
      widgetsRef.current = widgets;
      setWidgetsReady(true);
    }

    if (window.PayjpPayments) {
      mountWidgets();
    } else {
      const existing = document.querySelector('script[src="https://js.pay.jp/payments.js"]');
      const script = existing || document.createElement("script");
      if (!existing) {
        script.src = "https://js.pay.jp/payments.js";
        document.head.appendChild(script);
      }
      script.addEventListener("load", mountWidgets);
      return () => {
        cancelled = true;
        script.removeEventListener("load", mountWidgets);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [payjpV2, phase, v2Session, payjpV2PublicKey]);

  useEffect(() => {
    if (!usesV1Card) return;
    let cancelled = false;

    function setup() {
      if (cancelled || !cardMountRef.current || cardElementRef.current) return;
      const payjp = window.Payjp(PAYJP_PUBLIC_KEY);
      payjpRef.current = payjp;
      const elements = payjp.elements();
      const cardElement = elements.create("card");
      // payjp.js の mount() はDOM要素ではなくCSSセレクタ文字列を受け取る仕様のため、
      // ref先の要素にidを振ってセレクタで指定する。
      cardElement.mount(`#${cardMountRef.current.id}`);
      cardElement.on("change", (e) => {
        setCardBrand(e.brand && e.brand !== "unknown" ? e.brand : null);
        setCardComplete(!!e.complete);
        setCardFormError(e.error ? e.error.message : null);
      });
      cardElementRef.current = cardElement;
      setCardReady(true);
    }

    if (window.Payjp) {
      setup();
    } else {
      const existing = document.querySelector('script[src="https://js.pay.jp/v2/pay.js"]');
      const script = existing || document.createElement("script");
      if (!existing) {
        script.src = "https://js.pay.jp/v2/pay.js";
        document.head.appendChild(script);
      }
      script.addEventListener("load", setup);
      return () => script.removeEventListener("load", setup);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const payloadBase = useMemo(
    () => ({
      planId: plan.id,
      date,
      slotId: plan.time_type === "slot3" ? slotId : undefined,
      startTime: plan.time_type === "flexible" ? startTime : undefined,
      guestCount: isStayPlan ? stayGuestTotal : Number(guestCount),
      guestMale: isStayPlan ? (showMaleGuests ? Number(guestMale) || 0 : 0) : undefined,
      guestFemale: isStayPlan ? Number(guestFemale) || 0 : undefined,
      guestChildren: isStayPlan ? Number(guestChildren) || 0 : undefined,
      nights: plan.time_type === "stay_16_11" ? Number(nights) : undefined,
      optionIds,
      optionQuantities,
    }),
    [plan, date, slotId, startTime, guestCount, isStayPlan, showMaleGuests, stayGuestTotal, guestMale, guestFemale, guestChildren, nights, optionIds, optionQuantities]
  );

  async function checkAvailability() {
    if (!date) return;
    setChecking(true);
    setAvailability(null);
    setError(null);
    try {
      const res = await fetch(adminMode ? "/api/admin/availability" : "/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBase),
      });
      const data = await res.json();
      setAvailability(data);
    } catch (e) {
      setError("空き状況の確認に失敗しました。");
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (requiresPriorityClause && !agreedToPriorityClause) {
      setError("確認事項へのご同意にチェックしてください。");
      return;
    }
    if (usesV1Card && !cardComplete) {
      setError("お支払い情報（クレジットカード）を入力してください。");
      return;
    }
    if (isStayPlan && !customerAddress) {
      setError("宿泊者名簿の記載のため、ご住所の入力をお願いします。");
      return;
    }
    setSubmitting(true);
    setError(null);

    if (adminMode) {
      try {
        const res = await fetch("/api/admin/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payloadBase,
            customerName,
            customerEmail,
            customerTel,
            customerAddress: isStayPlan ? customerAddress : undefined,
            note,
            paymentMethod: adminPayMethod,
            status: adminStatus,
            totalPriceOverride: adminPriceOverride,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "予約の登録に失敗しました。内容をご確認ください。");
          setSubmitting(false);
          return;
        }
        window.location.href = `/admin/reservations/${data.reservationId}`;
      } catch (err) {
        setError("予約の登録に失敗しました。");
        setSubmitting(false);
      }
      return;
    }

    if (payjpV2) {
      // PAY.JP API v2：サーバーで料金を確定計算してPayment Flowを作成し、決済フォームを表示する。
      try {
        const createRes = await fetch("/api/payments/v2/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payloadBase, customerName, customerEmail, customerTel, customerAddress: isStayPlan ? customerAddress : undefined, note, method: payMethod }),
        });
        const createData = await createRes.json();
        if (createRes.ok) {
          setV2Session({
            clientSecret: createData.clientSecret,
            draftToken: createData.draftToken,
            paymentFlowId: createData.paymentFlowId,
            total: createData.price && createData.price.total,
          });
          setPhase("pay");
          setSubmitting(false);
          return;
        }
        if (createData.error !== "payment_not_required") {
          setError(createData.message || "お支払いの準備に失敗しました。日程・内容をご確認ください。");
          setSubmitting(false);
          return;
        }
        // 金額0円の場合は決済なしでそのまま予約する（下の通常処理へ）。
      } catch (err) {
        setError("お支払いの準備に失敗しました。通信状況をご確認のうえ再度お試しください。");
        setSubmitting(false);
        return;
      }
    }

    let payjpChargeId = null;
    if (usesV1Card) {
      try {
        const tokenRes = await payjpRef.current.createToken(cardElementRef.current);
        if (tokenRes.error) {
          setError(tokenRes.error.message || "カード情報の確認に失敗しました。");
          setSubmitting(false);
          return;
        }
        const payjpToken = tokenRes.id;

        // 支払い作成時の3Dセキュア：まずサーバー側で正式な料金を計算のうえ与信枠を確保する
        // （3Dセキュア認証待ちの状態）。
        setPaymentStep("authorize");
        const startRes = await fetch("/api/payments/start-3ds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payloadBase, customerEmail, payjpToken }),
        });
        const startData = await startRes.json();
        if (!startRes.ok) {
          setError(startData.message || "お支払い情報の確認に失敗しました。");
          setSubmitting(false);
          setPaymentStep(null);
          return;
        }

        // カード発行会社の本人認証画面（iframe）を表示する。
        setPaymentStep("3ds");
        try {
          await payjpRef.current.openThreeDSecureIframe(startData.chargeId);
        } catch (tdsErr) {
          const message = (tdsErr && tdsErr.error && tdsErr.error.message) || "本人認証（3Dセキュア）に失敗しました。お手数ですが再度お試しください。";
          setError(message);
          setSubmitting(false);
          setPaymentStep(null);
          return;
        }

        // 3Dセキュア認証の完了をサーバー側に反映（支払いの確定処理）。
        setPaymentStep("finish");
        const finishRes = await fetch("/api/payments/finish-3ds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chargeId: startData.chargeId }),
        });
        const finishData = await finishRes.json();
        if (!finishRes.ok) {
          setError(finishData.message || "本人認証（3Dセキュア）の確認に失敗しました。お手数ですが最初からやり直してください。");
          setSubmitting(false);
          setPaymentStep(null);
          return;
        }
        payjpChargeId = startData.chargeId;
      } catch (e) {
        setError("お支払い処理に失敗しました。カード情報をご確認のうえ再度お試しください。");
        setSubmitting(false);
        setPaymentStep(null);
        return;
      }
    }
    setPaymentStep(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payloadBase, customerName, customerEmail, customerTel, customerAddress: isStayPlan ? customerAddress : undefined, note, payjpChargeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "予約の作成に失敗しました。日程をご確認ください。");
        setSubmitting(false);
        return;
      }
      window.location.href = `/complete/${data.reservationId}`;
    } catch (e) {
      setError("予約の作成に失敗しました。");
      setSubmitting(false);
    }
  }

  async function handlePay() {
    if (!widgetsRef.current || !v2Session) return;
    setSubmitting(true);
    setError(null);
    try {
      const returnUrl = `${window.location.origin}/payment/return?t=${encodeURIComponent(v2Session.draftToken)}`;
      const result = await widgetsRef.current.confirmPayment({ return_url: returnUrl });
      // 成功時は自動的に return_url へ移動する。ここに来るのはエラー時のみ。
      if (result && result.error) {
        setError(result.error.message || "お支払いに失敗しました。内容をご確認のうえ再度お試しください。");
      }
    } catch (err) {
      setError("お支払い処理に失敗しました。時間をおいて再度お試しください。");
    }
    setSubmitting(false);
  }

  function backToForm() {
    setPhase("form");
    setV2Session(null);
    widgetsRef.current = null;
    setWidgetsReady(false);
    setError(null);
  }

  function toggleOption(id) {
    setOptionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function setOptionQuantity(id, value, max) {
    let qty = Math.max(0, Number(value) || 0);
    if (max != null) qty = Math.min(qty, max);
    setOptionQuantities((prev) => ({ ...prev, [id]: qty }));
  }

  return (
    <form
      onSubmit={(e) => {
        if (payjpV2 && phase === "pay") {
          e.preventDefault();
          handlePay();
        } else {
          handleSubmit(e);
        }
      }}
      className="space-y-6"
    >
      <fieldset disabled={phase === "pay"} className="contents">
      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-bold">日程・人数</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-black/50">利用日</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>

          {!isStayPlan && (
            <label className="block text-sm">
              <span className="text-black/50">人数</span>
              <input
                type="number"
                min={plan.min_guests || 1}
                max={plan.max_guests || 99}
                required
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
          )}
        </div>

        {isStayPlan && (
          <div className="space-y-2">
            <span className="text-sm text-black/50">
              {showMaleGuests
                ? "人数（宿泊者名簿のため、男性・女性・子供の内訳をご入力ください）"
                : "人数（宿泊者名簿のため、女性・子供の内訳をご入力ください）"}
            </span>
            <div className={showMaleGuests ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
              {showMaleGuests && (
                <label className="block text-sm">
                  <span className="text-black/40 text-xs">男性</span>
                  <input
                    type="number"
                    min="0"
                    value={guestMale}
                    onChange={(e) => setGuestMale(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="text-black/40 text-xs">女性</span>
                <input
                  type="number"
                  min="0"
                  value={guestFemale}
                  onChange={(e) => setGuestFemale(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-black/40 text-xs">子供（4〜12歳）</span>
                <input
                  type="number"
                  min="0"
                  value={guestChildren}
                  onChange={(e) => setGuestChildren(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                />
              </label>
            </div>
            <p className="text-xs text-black/40">
              合計 {stayGuestTotal}名
              {(plan.time_type === "stay_16_11") && Number(guestChildren) > 0 && "（子供料金は宿泊料金の70%）"}
            </p>
            {plan.min_guests != null && stayGuestTotal > 0 && stayGuestTotal < plan.min_guests && (
              <p className="text-xs text-red-600">このプランは最少{plan.min_guests}名からです。</p>
            )}
            {plan.max_guests != null && stayGuestTotal > plan.max_guests && (
              <p className="text-xs text-red-600">このプランは最大{plan.max_guests}名までです。</p>
            )}
          </div>
        )}

        {(plan.time_type === "slot3" || plan.time_type === "flexible") && (
          <TimeAxis resourceIds={plan.resources.map((r) => r.id)} date={date} />
        )}

        {plan.time_type === "slot3" && (
          <label className="block text-sm">
            <span className="text-black/50">利用時間帯（1部／2部／1日）</span>
            <select
              value={slotId}
              onChange={(e) => setSlotId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            >
              {slotOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        )}

        {plan.time_type === "flexible" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-black/50">開始時刻</span>
              <input
                type="time"
                min="11:00"
                max="22:00"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
            <p className="text-xs text-black/40 sm:col-span-2">
              ご利用時間の目安：{startTime || "11:00"}〜{computeFlexibleEndTime(plan.id, startTime)}
              （{flexibleDurationHours(plan.id)}時間、営業終了22:00まで）
            </p>
          </div>
        )}

        {(plan.time_type === "stay_11_11" || plan.time_type === "stay_18_11" || plan.time_type === "stay_16_11") && (
          <p className="text-xs text-black/40">
            {plan.time_type === "stay_11_11" && "チェックイン 11:00 / チェックアウト 翌11:00"}
            {plan.time_type === "stay_18_11" && "チェックイン 18:00 / チェックアウト 翌11:00"}
            {plan.time_type === "stay_16_11" && "チェックイン 16:00 / チェックアウト 翌11:00（連泊の場合は最終日の翌11:00）"}
          </p>
        )}

        {plan.time_type === "stay_16_11" && (
          <label className="block text-sm">
            <span className="text-black/50">宿泊日数</span>
            <select
              value={nights}
              onChange={(e) => setNights(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            >
              {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}泊</option>
              ))}
            </select>
          </label>
        )}

        {plan.options.length > 0 && (
          <div>
            <span className="text-sm text-black/50">オプション</span>
            <div className="mt-2 space-y-2">
              {plan.options.map((o) =>
                o.unit === "quantity" ? (
                  <div key={o.id} className="flex items-start gap-3 text-sm">
                    {o.imageUrl && (
                      <img src={o.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <span className="flex-1">
                      <span>
                        {o.name}
                        <span className="text-black/40">
                          {" "}
                          （{o.price ? `¥${o.price.toLocaleString()}／${o.unitLabel || "個"}` : "無料"}）
                        </span>
                      </span>
                      {o.description && (
                        <span className="block text-xs text-black/40 whitespace-pre-wrap">{o.description}</span>
                      )}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={o.maxQuantity ?? undefined}
                      value={optionQuantities[o.id] ?? 0}
                      onChange={(e) => setOptionQuantity(o.id, e.target.value, o.maxQuantity)}
                      className="w-20 rounded-lg border border-black/15 px-3 py-1.5"
                    />
                    <span className="text-black/40 text-xs">{o.unitLabel || "個"}</span>
                  </div>
                ) : (
                  <label key={o.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={optionIds.includes(o.id)}
                      onChange={() => toggleOption(o.id)}
                      className="mt-0.5"
                    />
                    {o.imageUrl && (
                      <img src={o.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <span className="flex-1">
                      <span>{o.name}</span>{" "}
                      <span className="text-black/40">{o.price ? `+¥${o.price.toLocaleString()}` : "無料"}</span>
                      {o.description && (
                        <span className="block text-xs text-black/40 whitespace-pre-wrap">{o.description}</span>
                      )}
                    </span>
                  </label>
                )
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={checkAvailability}
          disabled={!date || checking}
          className="text-sm rounded-full border border-ink px-4 py-2 hover:bg-black/5 disabled:opacity-40"
        >
          {checking ? "確認中…" : "空き状況・料金を確認"}
        </button>

        {availability && (
          <div
            className={`text-sm rounded-lg px-4 py-3 ${
              availability.available
                ? "bg-emerald-50 text-emerald-800"
                : availability.conflictType === "adjustable"
                ? "bg-amber-50 text-amber-800"
                : "bg-red-50 text-red-700"
            }`}
          >
            {availability.available ? (
              <>
                空きがあります。目安料金：¥{availability.price.total.toLocaleString()}
                {availability.price.optionBreakdown?.length > 0 && (
                  <span className="block text-xs mt-1 text-emerald-700">
                    内訳：
                    {availability.price.optionBreakdown
                      .map((o) => `${o.name}${o.unit === "quantity" ? `×${o.quantity}${o.unitLabel || "個"}` : ""} ¥${o.subtotal.toLocaleString()}`)
                      .join("、")}
                  </span>
                )}
                {availability.price.appliedRules?.some((r) => r.length > 0) && (
                  <span className="block text-xs mt-1 text-emerald-700">
                    適用ルール：{[...new Set(availability.price.appliedRules.flat())].join("、")}
                  </span>
                )}
              </>
            ) : availability.inquiryOnly ? (
              <InquiryNotice />
            ) : (
              availability.reason || "この日程は予約できません。"
            )}
          </div>
        )}
      </div>

      {requiresPriorityClause && (
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
          <h2 className="font-bold">確認事項</h2>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={agreedToPriorityClause}
              onChange={(e) => setAgreedToPriorityClause(e.target.checked)}
              className="mt-1"
              required
            />
            <span className="text-black/70">
              下記内容を確認・了承した
              <span className="block mt-1 text-xs text-black/50">
                本予約フォームはカフェ・飲食利用のご予約です。ご予約確定後であっても、宿泊・施設貸切のご予約が
                優先的に確定した場合、日程の変更をお願いすることがございます。該当する場合は、遅くともご利用日の
                2営業日前までにご連絡いたします。日程変更をお願いする際は、次回ご利用時にお使いいただける割引
                クーポンをご用意いたします。ご不便をおかけしますが、あらかじめご理解・ご了承のほど
                よろしくお願いいたします。
              </span>
            </span>
          </label>
        </div>
      )}

      {!adminMode && !payOnline && (
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-1">
          <h2 className="font-bold">お支払いについて</h2>
          <p className="text-sm text-black/60">このプランのお支払いは、ご利用当日に店頭でお願いいたします（オンライン決済は不要です）。</p>
        </div>
      )}

      {payOnline && (payjpV2 || usesV1Card) && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-1">
          <p>現在、VISA・MASTERカード、PayPayによる決済がご利用可能です。</p>
          <p>JCB・AMEX・DINERSは申請中のため、ご利用いただけません。</p>
          <p>
            ご利用ご希望の場合は、お電話にてお問い合わせください。
          </p>
          <a href={`tel:${PHONE_TEL}`} className="inline-flex items-center gap-1.5 font-bold underline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" />
            </svg>
            {PHONE_DISPLAY}
          </a>
        </div>
      )}

      {payjpV2 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
          <h2 className="font-bold">お支払い方法</h2>
          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input type="radio" name="payMethod" checked={payMethod === "card"} onChange={() => setPayMethod("card")} className="mt-1" />
              <span>
                クレジットカード
                <span className="block text-xs text-black/40">
                  ご予約確定時にお支払いが確定します（送信直後は与信枠の確保のみで、請求は発生しません）。
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="payMethod" checked={payMethod === "paypay"} onChange={() => setPayMethod("paypay")} className="mt-1" />
              <span>
                PayPay
                <span className="block text-xs text-black/40">
                  お申込み時に即時お支払いが確定します。キャンセル時はキャンセルポリシーに基づき返金いたします。
                </span>
              </span>
            </label>
          </div>
        </div>
      )}

      {usesV1Card && (
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
          <h2 className="font-bold">お支払い情報</h2>
          <p className="text-xs text-black/40">
            クレジットカード決済です。ご予約確定時にお支払いが確定します（送信直後は与信枠の確保のみで、請求は発生しません）。
          </p>
          <div
            id="payjp-card-element"
            ref={cardMountRef}
            className="rounded-lg border border-black/15 px-3 py-2.5 bg-white"
          />
          {!cardReady && <p className="text-xs text-black/30">決済フォームを読み込み中…</p>}
          {cardFormError && <p className="text-xs text-red-600">{cardFormError}</p>}
          {cardBrand && !cardFormError && <p className="text-xs text-black/40">カードブランド：{cardBrand}</p>}
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-bold">お客様情報</h2>
        <label className="block text-sm">
          <span className="text-black/50">お名前</span>
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-black/50">メールアドレス{adminMode ? "（任意）" : ""}</span>
          <input
            type="email"
            required={!adminMode}
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-black/50">電話番号</span>
          <input
            value={customerTel}
            onChange={(e) => setCustomerTel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
        {isStayPlan && (
          <label className="block text-sm">
            <span className="text-black/50">ご住所（宿泊者名簿のため必須）</span>
            <input
              required
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
        )}
        <label className="block text-sm">
          <span className="text-black/50">ご要望・備考</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
      </div>

      {adminMode && (
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-bold">受付情報（管理者のみ）</h2>
          <p className="text-xs text-black/40">
            決済・確認メールなしで登録します。支払い方法は備考欄の先頭に記録されます。
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block text-sm">
              <span className="text-black/50">お支払い方法</span>
              <select
                value={adminPayMethod}
                onChange={(e) => setAdminPayMethod(e.target.value)}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              >
                <option value="onsite">現地払い（当日）</option>
                <option value="invoice">請求書払い</option>
                <option value="bank_transfer">事前銀行振込</option>
                <option value="other">その他</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-black/50">予約の状態</span>
              <select
                value={adminStatus}
                onChange={(e) => setAdminStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              >
                <option value="confirmed">確定</option>
                <option value="pending_review">要確認</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-black/50">金額の上書き（空欄なら自動計算）</span>
              <input
                type="number"
                min="0"
                value={adminPriceOverride}
                onChange={(e) => setAdminPriceOverride(e.target.value)}
                placeholder="例: 30000"
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
          </div>
        </div>
      )}
      </fieldset>

      {payjpV2 && phase === "pay" && v2Session && (
        <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{payMethod === "paypay" ? "PayPayでお支払い" : "カード情報のご入力"}</h2>
            <button type="button" onClick={backToForm} className="text-xs underline text-black/40">
              入力内容を修正する
            </button>
          </div>
          {v2Session.total != null && (
            <p className="text-sm">
              お支払い金額：<span className="font-bold">¥{Number(v2Session.total).toLocaleString()}</span>
            </p>
          )}
          <div id="payjp-payment-form" />
          {!widgetsReady && <p className="text-xs text-black/30">決済フォームを読み込み中…</p>}
          {payMethod === "paypay" && (
            <p className="text-xs text-black/40">「支払う」を押すとPayPayの画面へ移動します。お支払い後、自動でこのサイトに戻り予約が完了します。</p>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">
          {error === INQUIRY_ONLY_MESSAGE ? <InquiryNotice /> : error}
        </div>
      )}

      {paymentStep && (
        <div className="text-sm text-black/60 bg-black/5 rounded-lg px-4 py-3">
          {paymentStep === "authorize" && "お支払い情報を確認しています…"}
          {paymentStep === "3ds" && "カード発行会社による本人認証（3Dセキュア）を行っています。画面の指示に従ってください。"}
          {paymentStep === "finish" && "本人認証を確認しています…"}
        </div>
      )}

      <button
        type="submit"
        disabled={
          submitting ||
          (requiresPriorityClause && !agreedToPriorityClause) ||
          (usesV1Card && !cardComplete) ||
          (payjpV2 && phase === "pay" && !widgetsReady)
        }
        className="w-full rounded-full bg-ink text-white px-6 py-3 font-semibold hover:opacity-90 disabled:opacity-40"
      >
        {submitting
          ? "送信中…"
          : adminMode
          ? "この内容で予約を登録する"
          : payjpV2 && phase === "pay"
          ? payMethod === "paypay"
            ? "PayPayで支払って予約する"
            : "支払って予約する（要確認）"
          : payjpV2
          ? "お支払いへ進む"
          : "この内容で予約する（要確認）"}
      </button>
      {!adminMode && (
        <>
          <p className="text-xs text-black/40 text-center">
            送信後は「要確認」ステータスとなり、担当者が確認のうえ確定のご連絡をいたします。
          </p>
          <p className="text-xs text-black/40 text-center">
            ご予約は
            <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline">
              利用規約（キャンセルポリシーを含む）
            </a>
            に同意のうえお申し込みいただいたものとみなします。
          </p>
        </>
      )}
    </form>
  );
}
