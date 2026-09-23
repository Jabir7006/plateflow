"use client"

import Image from "next/image"
import { Loader2, UtensilsCrossed, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { formatPrice } from "@/features/menu/format-price"
import type { Cart } from "../hooks/use-cart"
import { QuantityControl } from "./quantity-control"

interface CartSheetProps {
  open: boolean
  onClose: () => void
  cart: Cart
  // Optional "special instructions" note, lifted so it survives the sheet
  // closing/reopening and is cleared on a successful order.
  note: string
  onNoteChange: (note: string) => void
  // Whether an order is currently being placed (disables the submit button).
  placing: boolean
  // Places the order. Owned by MenuExperience so the bar and this sheet share
  // one mutation.
  onPlace: () => void
}

const NOTE_MAX = 200

// A slide-up sheet showing everything the diner has selected: a row per line
// with a thumbnail, name, per-line stepper and price, a "special instructions"
// note, then the grand total and a "Place order" button that sends it to the
// kitchen. Rendered inside the .menu-page tree (no portal) so the theme tokens
// resolve. Built with motion rather than a drawer lib to avoid a dependency for
// one sheet.
export function CartSheet({
  open,
  onClose,
  cart,
  note,
  onNoteChange,
  placing,
  onPlace,
}: CartSheetProps) {
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
                  {cart.lines.map(({ key, item, size, quantity, unitPrice }) => (
                    <li key={key} className="flex items-center gap-3 py-3">
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
                          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-muted to-brand/15">
                            <UtensilsCrossed className="size-5 text-brand/35" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {item.name}
                        </p>
                        {size ? (
                          <span className="mt-0.5 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {size.label}
                          </span>
                        ) : null}
                        <p className="mt-0.5 text-sm text-brand tabular-nums">
                          {formatPrice(unitPrice * quantity)}
                        </p>
                      </div>

                      <QuantityControl
                        variant="pill"
                        label={size ? `${item.name} ${size.label}` : item.name}
                        quantity={quantity}
                        onAdd={() => cart.add(item, size)}
                        onRemove={() => cart.remove(item.id, size?.id)}
                      />
                    </li>
                  ))}
                </ul>

                <div className="border-t border-border px-5 pt-3">
                  <label
                    htmlFor="order-note"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Special instructions
                    <span className="ml-1 font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="order-note"
                    value={note}
                    onChange={(e) => onNoteChange(e.target.value.slice(0, NOTE_MAX))}
                    maxLength={NOTE_MAX}
                    rows={2}
                    placeholder="e.g. no onions, extra spicy"
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none"
                  />

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-display text-xl font-bold text-foreground tabular-nums">
                      {formatPrice(cart.total)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onPlace}
                    disabled={placing}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 font-medium text-brand-foreground hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {placing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Placing order…
                      </>
                    ) : (
                      "Place order"
                    )}
                  </button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    We&apos;ll send this to the kitchen and show you its status.
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
