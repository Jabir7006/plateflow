"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ChevronRight, Loader2, ReceiptText, X } from "lucide-react"
import type { OrderStatus } from "@plateflow/shared"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/features/menu/format-price"
import { useOrderStatus, isTerminal } from "../hooks/use-order-status"
import { timeAgo } from "../time-ago"

interface OrdersSheetProps {
  open: boolean
  onClose: () => void
  token: string
  // Every order id this phone placed for the table, oldest first (as stored).
  orderIds: string[]
}

const STATUS_META: Record<OrderStatus, { label: string; dot: string }> = {
  PENDING: { label: "Order received", dot: "bg-amber-400" },
  PREPARING: { label: "Being prepared", dot: "bg-amber-400" },
  READY: { label: "Ready to serve", dot: "bg-emerald-400" },
  SERVED: { label: "Served", dot: "bg-muted-foreground/60" },
  CANCELLED: { label: "Cancelled", dot: "bg-destructive" },
}

// One row: reads its order's live status via the same hook the status page uses,
// so the label + total stay current (and polling stops at a terminal status).
function OrderRow({
  token,
  orderId,
  onNavigate,
}: {
  token: string
  orderId: string
  onNavigate: () => void
}) {
  const { data, isLoading, isError } = useOrderStatus(token, orderId)

  // A remembered id the server no longer knows (cleared DB in testing, or an
  // order that was deleted) shouldn't render a dead row.
  if (isError) return null

  const meta = data ? STATUS_META[data.status] : null
  const active = data ? !isTerminal(data.status) : false

  return (
    <Link
      href={`/t/${encodeURIComponent(token)}/order/${orderId}`}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted"
    >
      <span className="relative flex size-2.5 shrink-0">
        {active ? (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-60",
              meta?.dot
            )}
          />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-2.5 rounded-full",
            meta?.dot ?? "bg-muted"
          )}
        />
      </span>

      <div className="min-w-0 flex-1">
        {isLoading || !data ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading…
          </span>
        ) : (
          <>
            <p className="truncate text-sm font-medium text-foreground">
              {meta?.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {timeAgo(data.updatedAt)}
            </p>
          </>
        )}
      </div>

      {data ? (
        <span className="text-sm font-medium text-foreground tabular-nums">
          {formatPrice(data.total)}
        </span>
      ) : null}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

// A slide-up sheet listing every order this phone placed for the table, most
// recent first, each linking to its status page. Opened from the topbar orders
// button so it never occupies the menu or the order bar; mirrors CartSheet's
// structure (no portal — lives in the .menu-page tree so the theme resolves).
export function OrdersSheet({ open, onClose, token, orderIds }: OrdersSheetProps) {
  const recentFirst = [...orderIds].reverse()

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col justify-end"
          initial="hidden"
          animate="shown"
          exit="hidden"
        >
          <motion.button
            type="button"
            aria-label="Close your orders"
            onClick={onClose}
            variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Your orders"
            variants={{ hidden: { y: "100%" }, shown: { y: 0 } }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="relative mx-auto flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl border-t border-border bg-card pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="flex justify-center pt-3 pb-1">
              <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="flex items-center justify-between px-5 py-2">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Your orders
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {recentFirst.length > 0 ? (
              <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto px-3 pb-2">
                {recentFirst.map((id) => (
                  <OrderRow
                    key={id}
                    token={token}
                    orderId={id}
                    onNavigate={onClose}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-muted-foreground">
                <ReceiptText className="size-6" />
                <p className="text-sm">
                  You haven&apos;t placed any orders yet.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
