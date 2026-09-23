"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronUp, Loader2 } from "lucide-react"
import { formatPrice } from "@/features/menu/format-price"

interface OrderBarProps {
  itemCount: number
  total: number
  // Whether an order is being placed (shows a spinner + disables the button).
  placing: boolean
  // Opens the cart review sheet (the left "View order" tap zone).
  onOpen: () => void
  // Places the order straight away (the right "Order now" button).
  onPlace: () => void
}

// The bottom action bar: tapping the left zone (count + total) opens the review
// sheet, while the right "Order now" button places the order in one tap. Fixed
// to the viewport bottom (an overlay, not in flow) so it never shifts or shrinks
// the content above it. Slides up only once something is in the cart.
export function OrderBar({
  itemCount,
  total,
  placing,
  onOpen,
  onPlace,
}: OrderBarProps) {
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
          <div className="pointer-events-auto mx-auto flex w-full max-w-md flex-col gap-1 rounded-2xl border border-border bg-card/95 px-2 pt-1.5 pb-2 shadow-lg backdrop-blur-md">
            {/* Grab handle: a small bobbing pill hinting the left zone pulls up
                the review sheet. */}
            <motion.span
              aria-hidden
              animate={prefersReducedMotion ? undefined : { y: [0, -2, 0] }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
              }
              className="flex justify-center"
            >
              <span className="h-1 w-8 rounded-full bg-muted-foreground/30" />
            </motion.span>

            <div className="flex items-center justify-between gap-3 pl-2">
              {/* Left: opens the review sheet so the diner can check their items. */}
              <button
                type="button"
                onClick={onOpen}
                aria-label={`View order: ${itemCount} ${itemCount === 1 ? "item" : "items"}, ${formatPrice(total)}`}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl py-1 text-left"
              >
                <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-xs text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"} · View order
                  </span>
                  <span className="block font-display text-lg font-semibold text-foreground tabular-nums">
                    {formatPrice(total)}
                  </span>
                </span>
              </button>

              {/* Right: places the order in one tap. */}
              <motion.button
                type="button"
                onClick={onPlace}
                disabled={placing}
                aria-label="Order now"
                animate={
                  prefersReducedMotion || placing
                    ? undefined
                    : { scale: [1, 1.04, 1] }
                }
                transition={
                  prefersReducedMotion || placing
                    ? undefined
                    : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                }
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-medium whitespace-nowrap text-brand-foreground disabled:cursor-not-allowed disabled:opacity-70"
              >
                {placing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Placing…
                  </>
                ) : (
                  "Order now"
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
