"use client";

import { useEffect, useState } from "react";

const MAP_URL = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("長野県東御市和1093-2 MODANICA");

const A = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="underline break-all">
    {children}
  </a>
);

function Section({ title, children }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm space-y-2">
      <h2 className="font-bold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Ja({ official }) {
  return (
    <>
      <Section title="アクセス">
        <p>
          〒389-0505 長野県東御市和1093-2
          <br />
          <A href={MAP_URL}>Googleマップで開く</A>　／　電話 <a href="tel:09065079790" className="underline">090-6507-9790</a>
        </p>
        <p>
          お車：上信越道 東部湯の丸ICから約10分。国道18号に出て、上田方面へ。国道18号沿いの「ガーデンプラザ ワタベ」さまの駐車スペースから入り、細い路地の突き当たり、青い屋根の建物です。
          <br />
          電車：しなの鉄道 大屋駅から、タクシーで約5分、徒歩で約12分。
          <br />
          駐車場：敷地内に無料（6〜7台程度）
        </p>
        <p className="text-black/70">詳しい道順：<A href="https://modanica.net/access/">https://modanica.net/access/</A></p>
      </Section>
      <Section title="冬期の道路について">
        <p>冬期は、路面の凍結や積雪があります。お車でお越しの方は、スタッドレスタイヤまたはチェーンをご用意ください。</p>
      </Section>
      <Section title="チェックイン・チェックアウト">
        <p>
          チェックイン：16:00〜21:00（スタッフが対面でご案内します）
          <br />
          ・BBQ貸切プラン：11:00〜
          <br />
          ・飲み会貸切プラン：18:00〜
          <br />
          21:00以降の到着の場合も含め、あらかじめ到着時刻をお知らせください。
          <br />
          チェックアウト：10:30
        </p>
      </Section>
      {!official && (
      <Section title="宿泊者名簿">
        <p>旅館業法により、すべての宿泊者様の名簿が必要です。ご到着前にご記入ください（1分ほどで完了します）。</p>
        <p>
          <A href="/checkin">宿泊者名簿のフォームを開く</A>
        </p>
        <p>外国の方は、国籍とパスポート番号が必要です（チェックイン時にパスポートを確認します）。</p>
      </Section>
      )}
      <Section title="シャワーブース">
        <p>宿泊者の皆さまの共同利用です。複数組のご宿泊の日は、ご利用時間を設定します。</p>
      </Section>
      <Section title="部屋の仕様について">
        <p>
          ■ 1〜3人部屋（和室）
          <br />
          通常時は、ローテーブルとYogibo等のクッションでお過ごしいただき、就寝時に、布団とマットレスを、人数分お部屋に敷いてご利用いただきます。
          <br />
          ※3名でのご利用時は、部屋全体に布団が敷かれた状態になります。
        </p>
        <p>
          ■ 4人部屋
          <br />
          ダブルベッド1台、セミダブルベッド1台（合計2台）
          <br />
          ※ベッドは連結も可能です。事前にお申し付けください。
          <br />
          テーブル1、チェア2
        </p>
      </Section>
      <Section title="アメニティ">
        <p>
          ご用意：スリッパ、バスタオル、フェイスタオル、入浴タオル、歯ブラシ、ドライヤー
          <br />
          ご用意が無いもの：浴衣・パジャマ
        </p>
      </Section>
      <Section title="朝食">
        <p>ホットサンドやサンドイッチなどの軽食に、サラダ・コーヒーなどが付きます。ご希望の時間帯によっては、セルフサービスになります（現地でご案内します）。</p>
      </Section>
      <Section title="施設内でのお過ごし方">
        <p>貸切のご予約でない場合、カフェをご利用のお客様が、館内にいらっしゃることがあります。</p>
      </Section>
      <Section title="フード＆ドリンク">
        <p>
          メニュー：<A href="https://order.modanica.net/menu">https://order.modanica.net/menu</A>
        </p>
        <p>
          到着日のディナーをご希望の場合は、下記を事前予約にてご提供できます。
          <br />
          ・和牛ステーキディナーセット　+¥5,000
          <br />
          ・2種類のソースの和牛ハンバーグディナーセット　+¥4,000
          <br />
          ・低温調理の柔らかポークグリルディナーセット　+¥3,500
        </p>
        <p>
          ご希望の場合は、メッセージ等でお知らせください。
          <br />
          ※現地決済になります。
        </p>
      </Section>
      <Section title="近隣の温泉">
        <p>
          ■ みづほ温泉 湯楽里館　<A href="https://tomi-kosya.com/yurari/">https://tomi-kosya.com/yurari/</A>
          <br />
          10:00〜22:00（最終受付21:15）、冬期は10:30〜21:00（最終受付20:30）／休館日：毎週水曜日
          <br />
          入館料：大人650円、小学生300円／東御市和3875／TEL 0268-63-4126
        </p>
        <p>
          ■ 千曲川天然温泉 ゆぅふるTanaka　<A href="https://yufuru-tanaka.com/">https://yufuru-tanaka.com/</A>
          <br />
          10:00〜22:00／休館日：毎週火曜日／しなの鉄道 田中駅から徒歩1分／東御市田中278-18／TEL 0268-63-3715
        </p>
        <p className="text-xs text-black/50">※営業時間・料金は変更される場合があります。お出かけ前に、各施設のサイトでご確認ください。</p>
      </Section>
      <Section title="宿泊税">
        <p>長野県宿泊税：1名1泊 ¥200（宿泊料金が1人1泊6,000円（税抜）以上の場合）。宿泊料金とは別に、現地でお支払いください。</p>
      </Section>
      <Section title="お問い合わせ">
        <p>電話 <a href="tel:09065079790" className="underline">090-6507-9790</a></p>
      </Section>
    </>
  );
}

function En({ official }) {
  return (
    <>
      <Section title="Access">
        <p>
          1093-2 Wa, Tomi City, Nagano 389-0505, Japan
          <br />
          <A href={MAP_URL}>Open in Google Maps</A> / Tel <a href="tel:+819065079790" className="underline">+81-90-6507-9790</a>
        </p>
        <p>
          By car: about 10 min from Tobu-Yunomaru IC (Joshin-etsu Expressway). Take National Route 18 toward Ueda. Enter from the parking space of "Garden Plaza Watabe" on Route 18 and follow the narrow lane to its end; the building has a blue roof.
          <br />
          By train: Shinano Railway, Oya Station – about 5 min by taxi or 12 min on foot.
          <br />
          Parking: free, on site (about 6–7 cars).
        </p>
        <p className="text-black/70">Detailed directions: <A href="https://modanica.net/access/">https://modanica.net/access/</A></p>
      </Section>
      <Section title="Winter roads">
        <p>In winter, roads may be icy or snowy. If you drive, please use studless tires or chains.</p>
      </Section>
      <Section title="Check-in / Check-out">
        <p>
          Check-in: 16:00–21:00 (in person)
          <br />
          - BBQ private-use plan: from 11:00
          <br />
          - Party private-use plan: from 18:00
          <br />
          Please tell us your arrival time in advance, especially if you will arrive after 21:00.
          <br />
          Check-out: 10:30
        </p>
      </Section>
      {!official && (
      <Section title="Guest register">
        <p>Japanese law requires a register of all guests. Please fill it in before arrival (about 1 minute).</p>
        <p>
          <A href="/checkin">Open the guest register form</A>
        </p>
        <p>Foreign guests need to enter nationality and passport number (we will check your passport at check-in).</p>
      </Section>
      )}
      <Section title="Shower booth">
        <p>The shower booth is shared by all guests. When several parties stay on the same day, we will assign shower times.</p>
      </Section>
      <Section title="Rooms">
        <p>
          ■ Rooms for 1–3 guests (Japanese-style)
          <br />
          During the day, relax with a low table and cushions such as Yogibo. At bedtime, futons and mattresses are laid out in the room for each guest.
          <br />
          * With 3 guests, futons cover the entire room.
        </p>
        <p>
          ■ Room for 4 guests
          <br />
          1 double bed and 1 semi-double bed (2 beds in total)
          <br />
          * The beds can be joined together. Please ask us in advance.
          <br />
          1 table, 2 chairs
        </p>
      </Section>
      <Section title="Amenities">
        <p>
          Provided: slippers, bath towels, face towels, bath-use towels, toothbrush, hair dryer
          <br />
          Not provided: yukata / pajamas
        </p>
      </Section>
      <Section title="Breakfast">
        <p>Light breakfast: hot sandwiches / sandwiches with salad, coffee, etc. Depending on your preferred time, it may be self-service (we will explain on site).</p>
      </Section>
      <Section title="In the building">
        <p>Unless you booked the whole house, other cafe customers may be in the building.</p>
      </Section>
      <Section title="Food & drinks">
        <p>
          Menu: <A href="https://order.modanica.net/menu">https://order.modanica.net/menu</A>
        </p>
        <p>
          If you would like dinner on your arrival day, the following sets are available by advance reservation:
          <br />
          - Wagyu steak dinner set +¥5,000
          <br />
          - Wagyu hamburg steak dinner set with 2 kinds of sauce +¥4,000
          <br />
          - Tender low-temperature-cooked pork grill dinner set +¥3,500
        </p>
        <p>
          Please let us know by message if you would like one.
          <br />
          * Paid on site.
        </p>
      </Section>
      <Section title="Nearby hot springs">
        <p>
          ■ Mizuho Onsen Yurarikan <A href="https://tomi-kosya.com/yurari/">https://tomi-kosya.com/yurari/</A>
          <br />
          10:00–22:00 (last entry 21:15); winter 10:30–21:00 (last entry 20:30). Closed Wednesdays.
          <br />
          Adult ¥650, elementary school ¥300 / 3875 Wa, Tomi / Tel 0268-63-4126
        </p>
        <p>
          ■ Chikumagawa Onsen Yufuru Tanaka <A href="https://yufuru-tanaka.com/">https://yufuru-tanaka.com/</A>
          <br />
          10:00–22:00. Closed Tuesdays. 1 min on foot from Tanaka Station (Shinano Railway) / 278-18 Tanaka, Tomi / Tel 0268-63-3715
        </p>
        <p className="text-xs text-black/50">* Hours and prices may change. Please check each website before you go.</p>
      </Section>
      <Section title="Nagano accommodation tax">
        <p>¥200 per person per night (when the room rate is ¥6,000 or more per person per night, excluding tax). Paid on site, separately from the room charge.</p>
      </Section>
      <Section title="Contact">
        <p>Tel <a href="tel:+819065079790" className="underline">+81-90-6507-9790</a></p>
      </Section>
    </>
  );
}

// ご宿泊のご案内ページ（日本語／English 切り替え）
export default function GuideContent() {
  const [lang, setLang] = useState("ja");
  const [official, setOfficial] = useState(false);
  useEffect(() => {
    setOfficial(new URLSearchParams(window.location.search).get("src") === "official");
  }, []);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{lang === "ja" ? "ご宿泊のご案内" : "Guest Guide"}</h1>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setLang("ja")}
            className={`rounded-full border px-3 py-1 ${lang === "ja" ? "bg-black text-white border-black" : "border-black/20"}`}
          >
            日本語
          </button>
          <button
            onClick={() => setLang("en")}
            className={`rounded-full border px-3 py-1 ${lang === "en" ? "bg-black text-white border-black" : "border-black/20"}`}
          >
            English
          </button>
        </div>
      </div>
      {lang === "ja" ? <Ja official={official} /> : <En official={official} />}
    </div>
  );
}
