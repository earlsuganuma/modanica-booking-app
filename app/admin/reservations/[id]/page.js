import AdminReservationDetail from "../../../../components/AdminReservationDetail";

export const dynamic = "force-dynamic";

export default async function AdminReservationDetailPage({ params }) {
  const { id } = await params;
  return <AdminReservationDetail id={id} />;
}
