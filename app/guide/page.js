import GuideContent from "../../components/GuideContent";

export const metadata = {
  title: "ご宿泊のご案内 | MODANICA",
  robots: { index: false, follow: false },
};

// Booking.com・Airbnb などでご予約のお客様に、メッセージからご案内する、ご到着前の案内ページ。
export default function GuidePage() {
  return <GuideContent />;
}
