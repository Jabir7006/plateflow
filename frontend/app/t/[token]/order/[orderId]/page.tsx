import type { Metadata } from "next"

import { OrderStatusView } from "@/features/diner/components/order-status"

export const metadata: Metadata = {
  title: "Your order — PlateFlow",
  description: "Track your order's status.",
}

interface OrderPageProps {
  params: Promise<{ token: string; orderId: string }>
}

// The live status page for one placed order. The token + order id come from the
// path; the status itself is fetched (and polled) client-side by OrderStatusView.
// The `.menu-page` shell matches the menu so the diner stays in the same theme.
export default async function OrderPage({ params }: OrderPageProps) {
  const { token, orderId } = await params

  return (
    <div className="menu-page min-h-dvh bg-background text-foreground">
      <OrderStatusView token={token} orderId={orderId} />
    </div>
  )
}
