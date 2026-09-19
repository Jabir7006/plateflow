"use client"

import { LayoutGrid, Rows3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useMenuViewMode } from "../hooks/use-menu-view-mode"
import type { MenuViewMode } from "../view-mode"

const OPTIONS: { mode: MenuViewMode; label: string; Icon: typeof Rows3 }[] = [
  { mode: "list", label: "List view", Icon: Rows3 },
  { mode: "grid", label: "Grid view", Icon: LayoutGrid },
]

// A small segmented control. Read-only viewers see it too — it changes only how
// the client renders, so it isn't gated behind manage permissions.
export function MenuViewToggle() {
  const { mode, setMode } = useMenuViewMode()

  return (
    <div
      role="group"
      aria-label="Display style"
      className="inline-flex items-center gap-0.5 rounded-lg border p-0.5"
    >
      {OPTIONS.map(({ mode: value, label, Icon }) => {
        const active = mode === value
        return (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={active}
            className={cn(
              "size-7",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setMode(value)}
          >
            <Icon />
          </Button>
        )
      })}
    </div>
  )
}
