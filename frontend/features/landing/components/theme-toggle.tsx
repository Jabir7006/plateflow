"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

// Icons are toggled by the `.dark` class next-themes sets on <html> before
// paint, so there's no hydration flip and no mount guard to reason about.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </button>
  )
}
