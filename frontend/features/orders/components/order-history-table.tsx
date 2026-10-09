"use client"

import type { StaffOrderView } from "@plateflow/shared"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/features/menu/format-price"
import { formatOrderDateTime } from "../format-datetime"
import { HISTORY_STATUS_BADGE } from "../status"

interface OrderHistoryTableProps {
  orders: StaffOrderView[]
}

const itemCount = (order: StaffOrderView) =>
  order.lines.reduce((sum, line) => sum + line.quantity, 0)

const itemsSummary = (order: StaffOrderView) =>
  order.lines.map((line) => `${line.quantity}× ${line.name}`).join(", ")

export function OrderHistoryTable({ orders }: OrderHistoryTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="hidden grid-cols-[10rem_5rem_1fr_auto] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
        <span>Time</span>
        <span>Table</span>
        <span>Items</span>
        <span className="text-right">Status &amp; total</span>
      </div>

      <ul className="divide-y">
        {orders.map((order) => {
          const badge = HISTORY_STATUS_BADGE[order.status]
          const count = itemCount(order)
          return (
            <li
              key={order.id}
              className="flex flex-col gap-2 px-4 py-3 sm:grid sm:grid-cols-[10rem_5rem_1fr_auto] sm:items-center sm:gap-4"
            >
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatOrderDateTime(order.createdAt)}
              </span>
              <span className="text-sm font-medium">Table {order.tableNumber}</span>
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                <span className="text-foreground tabular-nums">
                  {count} {count === 1 ? "item" : "items"}
                </span>
                <span className="hidden sm:inline"> · {itemsSummary(order)}</span>
              </span>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="w-20 text-right text-sm font-medium tabular-nums">
                  {formatPrice(order.total)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
