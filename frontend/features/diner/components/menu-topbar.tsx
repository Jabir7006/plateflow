"use client"

import type { ViewMode } from "../hooks/use-view-mode"
import type { MenuTheme } from "../hooks/use-menu-theme"
import { ViewToggle } from "./view-toggle"
import { ThemeToggle } from "./theme-toggle"

interface MenuTopbarProps {
  tableNumber: number
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void
  theme: MenuTheme
  onThemeChange: (theme: MenuTheme) => void
}

// Compact sticky header for the diner menu: restaurant mark + which table the
// diner scanned on the left, the light/dark toggle and immersive/simple view
// toggle on the right. The cart and the orders list both live at the bottom, not
// here, so the header stays uncluttered on small phones.
export function MenuTopbar({
  tableNumber,
  mode,
  onModeChange,
  theme,
  onThemeChange,
}: MenuTopbarProps) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-5 pb-2">
      <div className="min-w-0">
        <p className="text-[0.65rem] font-medium tracking-[0.25em] text-brand uppercase">
          PlateFlow
        </p>
        <p className="text-sm text-muted-foreground">
          Table
          <span className="ml-1 font-medium text-foreground tabular-nums">
            {tableNumber}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle theme={theme} onChange={onThemeChange} />
        <ViewToggle mode={mode} onChange={onModeChange} />
      </div>
    </header>
  )
}
