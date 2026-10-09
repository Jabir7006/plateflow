import { PageHeader } from "@/features/dashboard/components/page-header"
import { OrderHistoryView } from "@/features/orders/components/order-history-view"

// Server shell; the history table, filters, and sales tiles are one client island.
export default function OrderHistoryPage() {
  return (
    <>
      <PageHeader
        title="History"
        description="Past orders, with sales totals for owners and managers."
      />

      <section aria-label="Order history" className="mt-6">
        <OrderHistoryView />
      </section>
    </>
  )
}
