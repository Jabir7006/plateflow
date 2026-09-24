"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { AlertTriangle, Clock } from "lucide-react"
import type { OrderStatus, StaffOrderView } from "@plateflow/shared"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { elapsedLabel, urgencyLevel, type Urgency } from "../elapsed"
import { NEXT_STATUS, STATUS_PILL } from "../status"

interface OrderCardProps {
  order: StaffOrderView
  // Shared board clock, so the timer ticks and urgency escalates without a fetch.
  now: number
  // Just arrived over the socket — briefly ringed so staff catch it.
  isNew?: boolean
  // Show the stage pill — used where stages are mixed in one list (small-screen
  // "All"); redundant inside a single-stage column, so off there.
  showStage?: boolean
  // An advance/cancel is in flight for this order; its buttons lock.
  busy?: boolean
  onAdvance: (orderId: string, status: OrderStatus) => void
  onCancel: (orderId: string) => void
}

// Left border warms as a ticket waits — the board's "what's late" signal.
const URGENCY_STRIPE: Record<Urgency, string> = {
  normal: "border-l-border",
  warn: "border-l-amber-500",
  late: "border-l-destructive",
}

const URGENCY_TIME: Record<Urgency, string> = {
  normal: "text-muted-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  late: "text-destructive font-semibold",
}

export function OrderCard({
  order,
  now,
  isNew,
  showStage,
  busy,
  onAdvance,
  onCancel,
}: OrderCardProps) {
  const next = NEXT_STATUS[order.status]
  const pill = showStage ? STATUS_PILL[order.status] : undefined
  const urgency = urgencyLevel(order.createdAt, now)

  // Cancel asks once before it fires — a mis-tap on a real order is costly. The
  // prompt reverts on its own so it can't sit armed.
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  useEffect(() => {
    if (!confirmingCancel) return
    const id = window.setTimeout(() => setConfirmingCancel(false), 4000)
    return () => window.clearTimeout(id)
  }, [confirmingCancel])

  return (
    <motion.div
      layout
      initial={isNew ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border border-l-4 border-border bg-card p-3 shadow-sm",
        URGENCY_STRIPE[urgency],
        isNew && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold">Table {order.tableNumber}</p>
          {pill ? (
            <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem] font-medium", pill.className)}>
              {pill.label}
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "flex items-center gap-1 text-xs tabular-nums",
            URGENCY_TIME[urgency]
          )}
        >
          {urgency === "late" ? (
            <AlertTriangle className="size-3.5" />
          ) : (
            <Clock className="size-3" />
          )}
          {elapsedLabel(order.createdAt, now)}
        </span>
      </div>

      <ul className="mt-2 space-y-1">
        {order.lines.map((line, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-primary">
              {line.quantity}×
            </span>
            <span className="min-w-0 flex-1">
              {line.name}
              {line.sizeLabel ? (
                <span className="text-muted-foreground"> · {line.sizeLabel}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {order.note ? (
        <p className="mt-2 rounded-lg bg-muted px-2 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Note:</span> {order.note}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        {confirmingCancel ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => onCancel(order.id)}
            >
              Cancel order
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingCancel(false)}
            >
              Keep
            </Button>
          </>
        ) : (
          <>
            {next ? (
              <Button
                size="sm"
                className={cn("flex-1", next.className)}
                disabled={busy}
                onClick={() => onAdvance(order.id, next.status)}
              >
                {next.label}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              disabled={busy}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </motion.div>
  )
}
