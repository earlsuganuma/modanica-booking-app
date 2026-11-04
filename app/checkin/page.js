import CheckinForm from "../../components/CheckinForm";

export const metadata = {
  title: "宿泊者名簿のご記入 | MODANICA",
  robots: { index: false, follow: false },
};

// Booking.com・Airbnb などでご予約のお客様向け。宿泊者名簿（旅館業法）のため、ご宿泊の前にご記入いただく。
export default function CheckinPage() {
  return <CheckinForm />;
}
