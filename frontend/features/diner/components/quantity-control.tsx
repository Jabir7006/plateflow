"use client"

import { AnimatePresence, motion } from "motion/react"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuantityControlProps {
  quantity: number
  onAdd: () => void
  onRemove: () => void
  // "pill" is the compact add/stepper for list rows; "solid" is the larger,
  // higher-contrast variant for the immersive hero.
  variant?: "pill" | "solid"
  label: string
}

// Add-to-cart control that morphs into a −/qty/+ stepper once the item is in the
// cart. Front-end only (see useCart) — no order is placed. When empty it's a
// single "Add" affordance; the count animates as it changes.
export function QuantityControl({
  quantity,
  onAdd,
  onRemove,
  variant = "pill",
  label,
}: QuantityControlProps) {
  const inCart = quantity > 0

  if (!inCart) {
    return (
      <motion.button
        type="button"
        onClick={onAdd}
        aria-label={`Add ${label}`}
        whileTap={{ scale: 0.92 }}
        className={cn(
          "flex items-center justify-center rounded-full font-medium transition-colors",
          variant === "pill"
            ? "size-9 bg-brand text-brand-foreground hover:brightness-105"
            : "h-11 w-full gap-2 bg-brand text-brand-foreground hover:brightness-105"
        )}
      >
        <Plus className="size-4" />
        {variant === "solid" ? <span>Add</span> : null}
      </motion.button>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-full bg-brand text-brand-foreground",
        variant === "pill" ? "h-9 gap-1 px-1" : "h-11 w-full gap-2 px-2"
      )}
    >
      <motion.button
        type="button"
        onClick={onRemove}
        aria-label={`Remove one ${label}`}
        whileTap={{ scale: 0.85 }}
        className="flex size-7 items-center justify-center rounded-full hover:bg-black/10"
      >
        <Minus className="size-4" />
      </motion.button>

      <span className="min-w-5 text-center text-sm font-semibold tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={quantity}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-block"
          >
            {quantity}
          </motion.span>
        </AnimatePresence>
      </span>

      <motion.button
        type="button"
        onClick={onAdd}
        aria-label={`Add one ${label}`}
        whileTap={{ scale: 0.85 }}
        className="flex size-7 items-center justify-center rounded-full hover:bg-black/10"
      >
        <Plus className="size-4" />
      </motion.button>
    </div>
  )
}
