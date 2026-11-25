import type { StaffOrderView } from "@plateflow/shared"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { STATUS_PILL } from "@/features/orders/status"

interface LiveOrdersCardProps {
  orders: StaffOrderView[]
}

export function LiveOrdersCard({ orders }: LiveOrdersCardProps) {
  const visibleOrders = [...orders]
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
    )
    .slice(0, 5)
  const remaining = orders.length - visibleOrders.length
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live orders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {orders.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            No live orders right now.
          </p>
        ) : (
          visibleOrders.map((order) => {
            const pill = STATUS_PILL[order.status]
            const itemCount = order.lines.reduce(
              (sum, line) => sum + line.quantity,
              0
            )

            return (
              <div
                key={order.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <p className="min-w-0 truncate text-sm">
                  <span className="font-medium">Table {order.tableNumber}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                </p>
                {pill ? (
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${pill.className}`}
                  >
                    {pill.label}
                  </span>
                ) : null}
              </div>
            )
          })
        )}
        {orders.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-sm">
            {remaining > 0 ? (
              <span className="text-muted-foreground">
                And {remaining} more.
              </span>
            ) : null}
            <Link
              href="/orders"
              className="ml-auto font-medium underline underline-offset-4"
            >
              View all orders
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
