"use client"

import { useState } from "react"
import type { OrderStatus } from "@plateflow/shared"
import { ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getErrorMessage } from "@/lib/api-error"
import { resolveRange, type RangePreset } from "../date-range"
import { useOrderHistory } from "../hooks/use-order-history"
import { useCanViewSalesReports } from "../hooks/use-can-view-sales-reports"
import { OrderHistoryFilters } from "./order-history-filters"
import { OrderHistorySkeleton } from "./order-history-skeleton"
import { OrderHistoryTable } from "./order-history-table"
import { PaginationControls } from "./pagination-controls"
import { SalesSummary } from "./sales-summary"

const PAGE_SIZE = 20

export function OrderHistoryView() {
  const canViewSales = useCanViewSalesReports()

  const [rangePreset, setRangePreset] = useState<RangePreset>("7d")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL")
  const [page, setPage] = useState(1)

  // The date inputs already cross-bound each other, but guard the reversed case
  // anyway rather than fire a request the backend would 400.
  const rangeError =
    rangePreset === "custom" && customFrom && customTo && customFrom > customTo
      ? "The start date must be on or before the end date."
      : null

  const range = resolveRange(rangePreset, { from: customFrom, to: customTo })

  const query = useOrderHistory(
    {
      page,
      pageSize: PAGE_SIZE,
      status: status === "ALL" ? undefined : status,
      from: range.from,
      to: range.to,
    },
    !rangeError
  )

  // Any filter change starts over at the first page.
  const handleRangePreset = (next: RangePreset) => {
    setRangePreset(next)
    setPage(1)
  }
  const handleCustomChange = (next: { from: string; to: string }) => {
    setCustomFrom(next.from)
    setCustomTo(next.to)
    setPage(1)
  }
  const handleStatusChange = (next: OrderStatus | "ALL") => {
    setStatus(next)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {canViewSales ? (
        <SalesSummary from={range.from} to={range.to} />
      ) : null}

      <OrderHistoryFilters
        rangePreset={rangePreset}
        onRangePreset={handleRangePreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomChange={handleCustomChange}
        status={status}
        onStatusChange={handleStatusChange}
        rangeError={rangeError}
      />

      <HistoryBody query={query} rangeError={rangeError} onPageChange={setPage} />
    </div>
  )
}

function HistoryBody({
  query,
  rangeError,
  onPageChange,
}: {
  query: ReturnType<typeof useOrderHistory>
  rangeError: string | null
  onPageChange: (page: number) => void
}) {
  const { data, isPending, isError, error, refetch, isFetching } = query

  // The filters already surface the message; nothing to load while it stands.
  if (rangeError) return null

  if (isPending) return <OrderHistorySkeleton />

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {getErrorMessage(error) ?? "We couldn't load the order history."}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (data.orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="mb-1 inline-flex size-11 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="size-5 text-muted-foreground" />
          </div>
          <p className="font-medium">No orders in this range</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Try a wider date range or a different status.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <OrderHistoryTable orders={data.orders} />
      <PaginationControls
        page={data.page}
        totalPages={data.totalPages}
        isFetching={isFetching}
        onPageChange={onPageChange}
      />
    </div>
  )
}
