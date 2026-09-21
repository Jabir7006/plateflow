"use client"

import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { SIZE_OPTIONS, type SizeOption } from "../size-options"

interface SizeSelectorProps {
  value: SizeOption
  onChange: (size: SizeOption) => void
}

// The S / M / L pills, as rounded squares like the reference. Visual only — the
// selected size doesn't change price yet (one price per item in the data
// model); it's the placeholder for real per-size pricing later. An amber tile
// glides behind the active option via a shared layoutId.
export function SizeSelector({ value, onChange }: SizeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Size"
      className="flex items-center justify-center gap-3"
    >
      {SIZE_OPTIONS.map((size) => {
        const isActive = size === value
        return (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(size)}
            className={cn(
              "relative flex size-12 items-center justify-center rounded-2xl border text-base font-semibold transition-colors",
              isActive
                ? "border-transparent text-brand-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="active-size"
                className="absolute inset-0 rounded-2xl bg-brand"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            ) : null}
            <span className="relative z-10">{size}</span>
          </button>
        )
      })}
    </div>
  )
}
