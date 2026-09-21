"use client"

import Image from "next/image"
import { UtensilsCrossed, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { formatPrice } from "@/features/menu/format-price"
import type { Cart } from "../hooks/use-cart"
import { QuantityControl } from "./quantity-control"

interface CartSheetProps {
  open: boolean
  onClose: () => void
  cart: Cart
}

// A slide-up sheet showing everything the diner has selected: a row per line
// with a thumbnail, name, per-line stepper and price, then the grand total and
// an "Order now" button. Rendered inside the .menu-page tree (no portal) so the
// theme tokens resolve. Read-only for now — ordering isn't wired up, so the
// button explains that. Built with motion rather than a drawer lib to avoid a
// dependency for one sheet.
export function CartSheet({ open, onClose, cart }: CartSheetProps) {
  const hasItems = cart.lines.length > 0

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col justify-end"
          initial="hidden"
          animate="shown"
          exit="hidden"
        >
          {/* Scrim */}
          <motion.button
            type="button"
            aria-label="Close order summary"
            onClick={onClose}
            variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Your order"
            variants={{
              hidden: { y: "100%" },
              shown: { y: 0 },
            }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="relative mx-auto flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl border-t border-border bg-card pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            {/* Grab handle */}
            <div className="flex justify-center pt-3 pb-1">
              <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="flex items-center justify-between px-5 py-2">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Your order
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

            {hasItems ? (
              <>
                <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-5">
                  {cart.lines.map(({ item, quantity }) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-brand/15">
                            <UtensilsCrossed className="size-5 text-brand/35" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="text-sm text-brand tabular-nums">
                          {formatPrice(item.price * quantity)}
                        </p>
                      </div>

                      <QuantityControl
                        variant="pill"
                        label={item.name}
                        quantity={quantity}
                        onAdd={() => cart.add(item)}
                        onRemove={() => cart.remove(item.id)}
                      />
                    </li>
                  ))}
                </ul>

                <div className="border-t border-border px-5 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-display text-xl font-bold text-foreground tabular-nums">
                      {formatPrice(cart.total)}
                    </span>
                  </div>

                  <button
                    type="button"
                    // Read-only: no order is placed yet.
                    onClick={() =>
                      window.alert(
                        "Ordering from your phone is coming soon. For now, please ask a member of staff to place your order."
                      )
                    }
                    className="mt-3 w-full rounded-xl bg-brand py-3.5 font-medium text-brand-foreground hover:brightness-105"
                  >
                    Order now
                  </button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Ordering from your phone is coming soon.
                  </p>
                </div>
              </>
            ) : (
              <p className="px-5 py-10 text-center text-muted-foreground">
                Your order is empty.
              </p>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
