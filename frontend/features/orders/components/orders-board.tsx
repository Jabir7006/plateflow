"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Volume2, VolumeX } from "lucide-react"
import type { OrderStatus, StaffOrderView } from "@plateflow/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getErrorMessage } from "@/lib/api-error"
import { useLiveOrders } from "../hooks/use-live-orders"
import { useAdvanceStatus } from "../hooks/use-advance-status"
import { useNow } from "../hooks/use-now"
import { BOARD_COLUMNS } from "../status"
import { primeAlert, playNewOrderAlert, useAlertMuted } from "../order-alert"
import { OrderCard } from "./order-card"

type Filter = "ALL" | OrderStatus

const byCreatedAsc = (a: StaffOrderView, b: StaffOrderView) =>
  a.createdAt.localeCompare(b.createdAt)

export function OrdersBoard() {
  const [muted, toggleMuted] = useAlertMuted()
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set())
  // Small-screen stages are one-at-a-time (three cramped columns don't work on a
  // phone or a portrait tablet); this picks which the single-column list shows.
  const [filter, setFilter] = useState<Filter>("ALL")

  // Read mute at alert time via a ref so the live-orders subscription doesn't
  // re-run (and reconnect the socket) when the toggle flips.
  const mutedRef = useRef(muted)
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  const handleNewOrder = useCallback((order: StaffOrderView) => {
    if (!mutedRef.current) playNewOrderAlert()
    setNewIds((prev) => new Set(prev).add(order.id))
    window.setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev)
        next.delete(order.id)
        return next
      })
    }, 6000)
  }, [])

  const { data, isPending, isError, error, refetch, isFetching } =
    useLiveOrders({ onNewOrder: handleNewOrder })

  const advance = useAdvanceStatus()
  const busyId = advance.isPending ? advance.variables?.orderId : undefined
  const now = useNow()

  const onAdvance = useCallback(
    (orderId: string, status: OrderStatus) => {
      advance.mutate({ orderId, status })
    },
    [advance]
  )
  const onCancel = useCallback(
    (orderId: string) => {
      advance.mutate({ orderId, status: "CANCELLED" })
    },
    [advance]
  )

  // The board runs untouched for long stretches, so unlock audio on the first
  // interaction — otherwise the very first new-order alert would be silently
  // dropped by the browser's autoplay policy.
  useEffect(() => {
    const onDown = () => primeAlert()
    window.addEventListener("pointerdown", onDown, { once: true })
    return () => window.removeEventListener("pointerdown", onDown)
  }, [])

  // Oldest first — the queue staff work front-to-back, and the order the lanes
  // and the list both read.
  const orders = useMemo(
    () => (data ? [...data].sort(byCreatedAsc) : []),
    [data]
  )

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Only block on a failure with nothing to show (initial load). Once the board
  // has orders, a failed background poll keeps the last-known board up — the
  // socket is still the live path — rather than blanking service with an error.
  if (isError && !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {getErrorMessage(error) ?? "We couldn't load your orders."}
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

  const renderCard = (order: StaffOrderView, showStage: boolean) => (
    <OrderCard
      key={order.id}
      order={order}
      now={now}
      isNew={newIds.has(order.id)}
      showStage={showStage}
      busy={busyId === order.id}
      onAdvance={onAdvance}
      onCancel={onCancel}
    />
  )

  const countFor = (f: Filter) =>
    f === "ALL" ? orders.length : orders.filter((o) => o.status === f).length

  const tabs: { key: Filter; title: string; dot: string | null }[] = [
    { key: "ALL", title: "All", dot: null },
    ...BOARD_COLUMNS.map((c) => ({
      key: c.status as Filter,
      title: c.title,
      dot: c.dot,
    })),
  ]

  const visible =
    filter === "ALL" ? orders : orders.filter((o) => o.status === filter)

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleMuted}
          aria-label={muted ? "Unmute new-order alerts" : "Mute new-order alerts"}
          aria-pressed={muted}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
      </div>

      {/* Small screens: one stage at a time. Three side-by-side columns are
          unusable on a phone or portrait tablet, so filter a single list. */}
      <div className="lg:hidden">
        <div
          role="tablist"
          aria-label="Order stage"
          className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1"
        >
          {tabs.map((tab) => {
            const active = filter === tab.key
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.dot ? (
                  <span className={cn("size-2 rounded-full", tab.dot)} />
                ) : null}
                {tab.title}
                <span className="tabular-nums text-muted-foreground">
                  {countFor(tab.key)}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3">
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground">
              Nothing here
            </p>
          ) : (
            visible.map((order) => renderCard(order, filter === "ALL"))
          )}
        </div>
      </div>

      {/* Large screens (wall display / landscape tablet): the three lanes. */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        {BOARD_COLUMNS.map((column) => {
          const columnOrders = orders.filter((o) => o.status === column.status)
          return (
            <section key={column.status} aria-label={column.title}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={cn("size-2.5 rounded-full", column.dot)} />
                <h2 className="text-sm font-semibold">{column.title}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {columnOrders.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {columnOrders.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    Nothing here
                  </p>
                ) : (
                  columnOrders.map((order) => renderCard(order, false))
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
