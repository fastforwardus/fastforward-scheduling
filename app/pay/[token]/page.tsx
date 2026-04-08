import PayClient from "@/components/pay/PayClient";

export const dynamic = "force-dynamic";

export default function PayPage({ params }: { params: { token: string } }) {
  return <PayClient token={params.token} />;
}
