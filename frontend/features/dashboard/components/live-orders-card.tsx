import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LiveOrder, LiveOrderStatus } from "../data"

// Status-to-badge translation keeps the order rows dumb: when the API arrives,
// this map is the only thing that needs to follow it.
const STATUS_BADGES: Record<
  LiveOrderStatus,
  { label: string; variant: "destructive" | "warning" | "success" }
> = {
  PENDING: { label: "Pending", variant: "destructive" },
  PREPARING: { label: "Preparing", variant: "warning" },
  READY: { label: "Ready", variant: "success" },
}

interface LiveOrdersCardProps {
  orders: LiveOrder[]
}

export function LiveOrdersCard({ orders }: LiveOrdersCardProps) {
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
          orders.map((order) => {
            const badge = STATUS_BADGES[order.status]

            return (
              <div
                key={order.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <p className="min-w-0 truncate text-sm">
                  <span className="font-medium">{order.table}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                  </span>
                </p>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
