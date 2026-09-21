"use client"

import { AnimatePresence, motion } from "motion/react"
import { Moon, Sun } from "lucide-react"
import type { MenuTheme } from "../hooks/use-menu-theme"

interface ThemeToggleProps {
  theme: MenuTheme
  onChange: (theme: MenuTheme) => void
}

// A single round button that flips the diner menu between light and dark. Shows
// the current theme's icon (sun in light, moon in dark) and swaps to the other
// on tap; the icon cross-fades so the change feels intentional. The choice is
// remembered per phone (see useMenuTheme).
export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const isDark = theme === "dark"

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => onChange(isDark ? "light" : "dark")}
      className="relative flex size-8 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.18 }}
          className="flex items-center justify-center"
        >
          {isDark ? (
            <Moon className="size-4" />
          ) : (
            <Sun className="size-4" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
