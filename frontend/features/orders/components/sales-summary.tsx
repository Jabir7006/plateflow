"use client"

import { orderStatusValues, type OrderStatus } from "@plateflow/shared"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { formatPrice } from "@/features/menu/format-price"
import { getErrorMessage } from "@/lib/api-error"
import { Skeleton } from "@/components/ui/skeleton"
import { HISTORY_STATUS_BADGE } from "../status"
import { useOrderStats } from "../hooks/use-order-stats"

// Lifecycle order for the per-status breakdown, terminal states last. Taken from
// the shared enum (which is in that order) so a new status can't silently miss
// the breakdown — adding one to orderStatusValues flows through here.
const STATUS_ORDER: readonly OrderStatus[] = orderStatusValues

interface SalesSummaryProps {
  from?: string
  to?: string
}

const tileGrid = "grid grid-cols-2 gap-3 lg:grid-cols-4"

// The management-only sales summary above the history table. Rendered only for
// roles that pass useCanViewSalesReports, so the query behind it never fires for
// anyone the backend would 403.
export function SalesSummary({ from, to }: SalesSummaryProps) {
  const { data, isPending, isError, error } = useOrderStats({ from, to })

  if (isPending) {
    return (
      <div className={tileGrid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[86px] rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          {getErrorMessage(error) ?? "We couldn't load the sales summary."}
        </CardContent>
      </Card>
    )
  }

  const countOf = (status: OrderStatus) =>
    data.byStatus.find((row) => row.status === status)?.count ?? 0

  return (
    <div className="space-y-3">
      <div className={tileGrid}>
        <StatCard label="Revenue (served)" value={formatPrice(data.revenue)} />
        <StatCard label="Orders" value={String(data.totalOrders)} />
        <StatCard label="Served" value={String(countOf("SERVED"))} />
        <StatCard
          label="Cancelled"
          value={String(countOf("CANCELLED"))}
          valueClassName={countOf("CANCELLED") > 0 ? "text-destructive" : undefined}
        />
      </div>

      <Card>
        <CardContent className="divide-y py-0">
          {STATUS_ORDER.map((status) => {
            const row = data.byStatus.find((r) => r.status === status)
            const badge = HISTORY_STATUS_BADGE[status]
            return (
              <div
                key={status}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <span className="font-medium">{badge.label}</span>
                <span className="flex items-center gap-4 tabular-nums text-muted-foreground">
                  <span>
                    {row?.count ?? 0}{" "}
                    {(row?.count ?? 0) === 1 ? "order" : "orders"}
                  </span>
                  <span className="w-24 text-right text-foreground">
                    {formatPrice(row?.revenue ?? 0)}
                  </span>
                </span>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
