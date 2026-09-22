"use client"

import { useId } from "react"
import { motion } from "motion/react"
import type { MenuItemSize } from "@plateflow/shared"
import { cn } from "@/lib/utils"

interface SizeSelectorProps {
  sizes: MenuItemSize[]
  value: string
  onChange: (sizeId: string) => void
}

// Pills for an item's sizes, labelled with whatever the item defines ("S",
// "Regular", '12"'). An amber tile glides behind the active option. The
// layoutId is scoped per instance so the tile doesn't animate between cards.
export function SizeSelector({ sizes, value, onChange }: SizeSelectorProps) {
  const layoutId = useId()

  return (
    <div
      role="radiogroup"
      aria-label="Size"
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {sizes.map((size) => {
        const isActive = size.id === value
        return (
          <button
            key={size.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(size.id)}
            className={cn(
              "relative flex h-11 min-w-11 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition-colors",
              isActive
                ? "border-transparent text-brand-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-2xl bg-brand"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            ) : null}
            <span className="relative z-10">{size.label}</span>
          </button>
        )
      })}
    </div>
  )
}
