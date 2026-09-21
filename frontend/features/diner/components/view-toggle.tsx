"use client"

import { motion } from "motion/react"
import { LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewMode } from "../hooks/use-view-mode"

interface ViewToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

const OPTIONS: { mode: ViewMode; label: string; Icon: typeof LayoutGrid }[] = [
  { mode: "immersive", label: "Immersive view", Icon: LayoutGrid },
  { mode: "simple", label: "Simple list view", Icon: List },
]

// Segmented control that swaps between the immersive carousel and the simple
// list. The choice is remembered per phone (see useViewMode). An amber knob
// slides behind the active icon via a shared layoutId.
export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Menu layout"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur"
    >
      {OPTIONS.map(({ mode: optionMode, label, Icon }) => {
        const isActive = optionMode === mode
        return (
          <button
            key={optionMode}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            onClick={() => onChange(optionMode)}
            className={cn(
              "relative flex size-8 items-center justify-center rounded-full transition-colors",
              isActive
                ? "text-brand-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="active-view"
                className="absolute inset-0 rounded-full bg-brand"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            ) : null}
            <Icon className="relative z-10 size-4" />
          </button>
        )
      })}
    </div>
  )
}
