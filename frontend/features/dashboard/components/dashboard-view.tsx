"use client"

import { Ellipsis } from "lucide-react"
import { useCallback, useEffect } from "react"
import type { StaffOrderView } from "@plateflow/shared"
import { formatReportingPeriod } from "@plateflow/shared"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { handleUnauthorized } from "@/features/auth/handle-auth-error"
import { getErrorMessage } from "@/lib/api-error"
import { InviteStaffButton } from "@/features/staff/components/invite-staff-button"
import { getInvitableRolesFor } from "@/features/staff/permissions"
import { formatPrice } from "@/features/menu/format-price"
import {
  activeOrdersKey,
  useLiveOrders,
} from "@/features/orders/hooks/use-live-orders"
import { useDashboardSummary } from "../hooks/use-dashboard-summary"
import { useDashboardRefresh } from "../hooks/use-dashboard-refresh"
import {
  DashboardCardSkeleton,
  DashboardMetricsSkeleton,
} from "./dashboard-skeleton"
import { LiveOrdersCard } from "./live-orders-card"
import { PageHeader } from "./page-header"
import { OutOfStockCard } from "./out-of-stock-card"
import { StatCard } from "./stat-card"

export function DashboardView() {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const summary = useDashboardSummary()
  const refresh = useDashboardRefresh()
  const onOrderUpdated = useCallback(
    (order: StaffOrderView) => {
      // Active-to-active transitions only change the live list's badge. Summary
      // counts, occupied tables and placement-day sales change on terminal steps.
      if (order.status === "SERVED" || order.status === "CANCELLED")
        refresh.schedule()
    },
    [refresh]
  )
  const orders = useLiveOrders({
    onNewOrder: refresh.schedule,
    onOrderUpdated,
    onConnect: refresh.schedule,
  })
  const refreshDashboard = useCallback(() => {
    refresh.flush()
    void queryClient.invalidateQueries({ queryKey: activeOrdersKey })
  }, [refresh, queryClient])
  const dashboardError = summary.isError
    ? summary.error
    : orders.isError
      ? orders.error
      : null
  useEffect(() => {
    if (dashboardError) handleUnauthorized(dashboardError)
  }, [dashboardError])

  const canInviteStaff = user
    ? getInvitableRolesFor(user.role).length > 0
    : false
  const reportingLabel = summary.data
    ? formatReportingPeriod(summary.data.period)
    : undefined

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          <span
            className="block h-5 w-64 max-w-[calc(100vw-3rem)] truncate sm:w-80"
            title={reportingLabel}
          >
            {reportingLabel ?? (
              <span
                role="status"
                className="block h-5 w-48 animate-pulse rounded-md bg-muted"
              >
                <span className="sr-only">Loading reporting date…</span>
              </span>
            )}
          </span>
        }
        actions={
          <>
            {canInviteStaff ? <InviteStaffButton /> : null}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Dashboard options"
                  >
                    <Ellipsis />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={refreshDashboard}>
                  Refresh data
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {dashboardError ? (
        <div
          role="alert"
          className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4"
        >
          <p className="text-sm text-muted-foreground">
            {getErrorMessage(dashboardError) ?? "Couldn't load your dashboard."}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={summary.isFetching || orders.isFetching}
            onClick={() => {
              void summary.refetch()
              void orders.refetch()
            }}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {summary.isPending || summary.data ? (
        <section aria-label="Key metrics" className="mt-6">
          {summary.isPending ? (
            <DashboardMetricsSkeleton />
          ) : summary.data ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Served orders placed today"
                value={
                  summary.data.salesToday === null
                    ? "—"
                    : formatPrice(summary.data.salesToday)
                }
              />
              <StatCard
                label="Active orders"
                value={String(summary.data.activeOrders)}
              />
              <StatCard
                label="Tables occupied"
                value={`${summary.data.tables.occupied} / ${summary.data.tables.total}`}
              />
              <StatCard
                label="Out of stock"
                value={`${summary.data.outOfStock.count} ${summary.data.outOfStock.count === 1 ? "item" : "items"}`}
                valueClassName="text-destructive"
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {orders.isPending || orders.data || summary.isPending || summary.data ? (
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          {orders.isPending ? (
            <DashboardCardSkeleton label="Loading live orders" />
          ) : orders.data ? (
            <LiveOrdersCard orders={orders.data} />
          ) : null}
          {summary.isPending ? (
            <DashboardCardSkeleton label="Loading out-of-stock items" />
          ) : summary.data ? (
            <OutOfStockCard outOfStock={summary.data.outOfStock} />
          ) : null}
        </section>
      ) : null}
    </>
  )
}
