"use client"

import { useEffect, useRef } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface CategoryNavProps {
  categories: { id: string; name: string }[]
  activeId: string
  onSelect: (id: string) => void
}

// A horizontally-scrolling chip bar that selects the active category. Unlike the
// old scroll-spy version, tapping a chip switches which category's dishes are
// shown (both views render one category at a time), so this drives state rather
// than jumping to an anchor. An amber pill slides behind the active chip via a
// shared layoutId. Hidden below two categories — nothing to switch between.
export function CategoryNav({ categories, activeId, onSelect }: CategoryNavProps) {
  const chipRefs = useRef(new Map<string, HTMLButtonElement>())

  // Keep the active chip in view as it changes (e.g. switched from the deck),
  // so a long bar always shows the current category.
  useEffect(() => {
    chipRefs.current.get(activeId)?.scrollIntoView({
      block: "nearest",
      inline: "center",
    })
  }, [activeId])

  if (categories.length < 2) return null

  return (
    <nav aria-label="Menu categories">
      <ul className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((category) => {
          const isActive = category.id === activeId
          return (
            <li key={category.id}>
              <button
                type="button"
                ref={(el) => {
                  if (el) chipRefs.current.set(category.id, el)
                  else chipRefs.current.delete(category.id)
                }}
                onClick={() => onSelect(category.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative inline-flex items-center rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "border-transparent text-brand-foreground"
                    : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="active-category"
                    className="absolute inset-0 rounded-full bg-brand"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                ) : null}
                <span className="relative z-10">{category.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
