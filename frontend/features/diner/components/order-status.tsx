"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import {
  ArrowLeft,
  Bell,
  Check,
  ChefHat,
  Loader2,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import type { OrderStatus } from "@plateflow/shared"
import { ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/features/menu/format-price"
import { useOrderStatus, isTerminal } from "../hooks/use-order-status"
import { useMenuTheme } from "../hooks/use-menu-theme"
import { timeAgo } from "../time-ago"
import { playChime, primeChime, useChimeMuted } from "../order-chime"

interface OrderStatusViewProps {
  token: string
  orderId: string
}

// The happy-path lifecycle as a diner reads it. CANCELLED isn't a step — it's a
// separate outcome, handled on its own below.
const STEPS: {
  status: OrderStatus
  label: string
  hint: string
  icon: LucideIcon
}[] = [
  {
    status: "PENDING",
    label: "Order received",
    hint: "The kitchen has your order.",
    icon: Check,
  },
  {
    status: "PREPARING",
    label: "Being prepared",
    hint: "Your food is on the stove.",
    icon: ChefHat,
  },
  {
    status: "READY",
    label: "Ready",
    hint: "On its way to your table.",
    icon: Bell,
  },
  {
    status: "SERVED",
    label: "Served",
    hint: "Enjoy your meal!",
    icon: UtensilsCrossed,
  },
]

// The status page: polls the order (via useOrderStatus), draws a stepper, and on
// every status change plays a chime and pulses the active step so a distracted
// diner notices. All transport lives in the hook, so swapping polling for a
// WebSocket later doesn't touch this component.
export function OrderStatusView({ token, orderId }: OrderStatusViewProps) {
  const { data, isLoading, isError, error } = useOrderStatus(token, orderId)

  const [muted, toggleMute] = useChimeMuted()
  const prevStatus = useRef<OrderStatus | null>(null)
  const [pulse, setPulse] = useState(false)
  const [, setTick] = useState(0)

  // Read `muted` at chime time via a ref so the pulse effect below doesn't depend
  // on it — otherwise toggling mute mid-pulse would re-run the effect, cancel the
  // pending clear-timeout, and leave the pulse stuck on.
  const mutedRef = useRef(muted)
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // Follow the diner's pinned menu theme on this page too. There's exactly one
  // `.menu-page` in the tree (the server shell), so target it directly rather
  // than threading a ref through the conditional branches below.
  const [theme] = useMenuTheme()
  useEffect(() => {
    const page = document.querySelector(".menu-page")
    if (!page) return
    page.classList.toggle("menu-light", theme === "light")
    page.classList.toggle("menu-dark", theme === "dark")
  }, [theme])

  // The tap that brought the diner here lets us start the audio context; also
  // catch the first tap on the page in case of a cold reload.
  useEffect(() => {
    primeChime()
    const onDown = () => primeChime()
    window.addEventListener("pointerdown", onDown, { once: true })
    return () => window.removeEventListener("pointerdown", onDown)
  }, [])

  // Refresh the "updated X min ago" label while the page sits open, even between
  // polls or after the order reaches a terminal status (polling stops there).
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000)
    return () => window.clearInterval(id)
  }, [])

  // Chime + pulse whenever the status actually changes (not on first load).
  // Depends only on the status: mute is read from a ref so a toggle can't cancel
  // an in-flight pulse.
  useEffect(() => {
    const status = data?.status
    if (!status) return
    if (prevStatus.current && prevStatus.current !== status) {
      if (!mutedRef.current) playChime()
      setPulse(true)
      prevStatus.current = status
      const t = window.setTimeout(() => setPulse(false), 1400)
      return () => window.clearTimeout(t)
    }
    prevStatus.current = status
  }, [data?.status])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !data) {
    const notFound = error instanceof ApiError && error.statusCode === 404
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UtensilsCrossed className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {notFound ? "We couldn't find this order" : "Something went wrong"}
        </h1>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {notFound
            ? "This order may be from another table, or the link is out of date. Ask a member of staff if you need help."
            : "We couldn't load your order just now. Please check your connection and try again."}
        </p>
        <Link
          href={`/t/${encodeURIComponent(token)}`}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-medium text-brand-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to menu
        </Link>
      </div>
    )
  }

  const cancelled = data.status === "CANCELLED"
  const activeIndex = STEPS.findIndex((s) => s.status === data.status)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <Link
          href={`/t/${encodeURIComponent(token)}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Menu
        </Link>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute status sounds" : "Mute status sounds"}
          aria-pressed={muted}
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>

      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Table {data.tableNumber}
        </h1>
        <span className="text-xs text-muted-foreground">
          Updated {timeAgo(data.updatedAt)}
        </span>
      </div>

      {cancelled ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4">
          <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-foreground">Order cancelled</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This order was cancelled. Please ask a member of staff if you have
              any questions.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Current-status headline: re-mounts on change (via key) so it pops in. */}
          <motion.div
            key={data.status}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-5 flex items-center gap-2"
          >
            {!isTerminal(data.status) ? (
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
              </span>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {STEPS[activeIndex]?.hint}
            </p>
          </motion.div>

          {/* Stepper */}
          <ol className="flex flex-col gap-1">
            {STEPS.map((step, i) => {
              const done = i < activeIndex
              const current = i === activeIndex
              const Icon = step.icon
              return (
                <li key={step.status} className="flex items-start gap-3">
                  <div className="flex flex-col items-center self-stretch">
                    <motion.span
                      animate={
                        current && pulse ? { scale: [1, 1.18, 1] } : { scale: 1 }
                      }
                      transition={{ duration: 0.6 }}
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                        done || current
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-border bg-card text-muted-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                    </motion.span>
                    {i < STEPS.length - 1 ? (
                      <span
                        className={cn(
                          "my-1 w-px flex-1",
                          done ? "bg-brand" : "bg-border"
                        )}
                      />
                    ) : null}
                  </div>
                  <div className={cn("pb-4 pt-1.5", current && "pb-5")}>
                    <p
                      className={cn(
                        "font-medium",
                        done || current
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </p>
                    {current ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {step.hint}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </>
      )}

      {/* Items */}
      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card/60">
        {data.lines.map((line, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-6 font-display text-sm font-semibold text-brand tabular-nums">
              {line.quantity}×
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{line.name}</p>
              {line.sizeLabel ? (
                <span className="mt-0.5 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {line.sizeLabel}
                </span>
              ) : null}
            </div>
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatPrice(line.unitPrice * line.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {data.note ? (
        <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Note:</span> {data.note}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between px-1">
        <span className="text-muted-foreground">Total</span>
        <span className="font-display text-xl font-bold text-foreground tabular-nums">
          {formatPrice(data.total)}
        </span>
      </div>
    </div>
  )
}

