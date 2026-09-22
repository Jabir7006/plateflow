"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronUp } from "lucide-react"
import { formatPrice } from "@/features/menu/format-price"

interface OrderBarProps {
  itemCount: number
  total: number
  // Tapping the bar (or its "Order now" button) opens the cart review sheet so
  // the diner can see what they've selected.
  onOpen: () => void
}

// The bottom action bar: running item count + total on the left, a gently
// pulsing "Order now" on the right. Fixed to the viewport bottom (an overlay,
// not in flow) so it never shifts or shrinks the content above it. Slides up
// only once something is in the cart. Read-only for now — tapping opens the
// review sheet rather than placing an order.
export function OrderBar({ itemCount, total, onOpen }: OrderBarProps) {
  const prefersReducedMotion = useReducedMotion()
  const hasItems = itemCount > 0

  return (
    <AnimatePresence>
      {hasItems ? (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Review order: ${itemCount} ${itemCount === 1 ? "item" : "items"}, ${formatPrice(total)}. Tap to open.`}
            className="pointer-events-auto mx-auto flex w-full max-w-md flex-col items-stretch gap-1 rounded-2xl border border-border bg-card/95 px-2 pt-1.5 pb-2 text-left shadow-lg backdrop-blur-md"
          >
            {/* Grab handle: a small bobbing pill + chevron so it reads as a sheet
                that pulls up, telling the diner they can tap to see their items. */}
            <motion.span
              aria-hidden
              animate={
                prefersReducedMotion ? undefined : { y: [0, -2, 0] }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
              }
              className="flex justify-center"
            >
              <span className="h-1 w-8 rounded-full bg-muted-foreground/30" />
            </motion.span>

            <span className="flex items-center justify-between gap-3 pl-2">
              <span className="flex min-w-0 items-center gap-2">
                <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-xs text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"} · View order
                  </span>
                  <span className="block font-display text-lg font-semibold text-foreground tabular-nums">
                    {formatPrice(total)}
                  </span>
                </span>
              </span>

              <motion.span
                // The pulse invites a tap; it's a span (the whole bar is the
                // button) so it stays a single accessible control.
                animate={
                  prefersReducedMotion ? undefined : { scale: [1, 1.04, 1] }
                }
                transition={
                  prefersReducedMotion
                    ? undefined
                    : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                }
                className="shrink-0 rounded-xl bg-brand px-5 py-2.5 font-medium whitespace-nowrap text-brand-foreground"
              >
                Order now
              </motion.span>
            </span>
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
