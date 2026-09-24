import { PageHeader } from "@/features/dashboard/components/page-header"
import { OrdersBoard } from "@/features/orders/components/orders-board"

// Server component shell; the live board is the only client island. Orders arrive
// and advance over the socket, so there's nothing to render on the server.
export default function OrdersPage() {
  return (
    <>
      <PageHeader
        title="Orders"
        description="Live kitchen board — new orders appear here as diners place them."
      />

      <section aria-label="Live orders" className="mt-6">
        <OrdersBoard />
      </section>
    </>
  )
}
