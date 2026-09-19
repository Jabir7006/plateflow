import { Skeleton } from "@/components/ui/skeleton"
import type { MenuViewMode } from "../view-mode"

const gridClassName = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"

// Mirrors the loaded layout (grouped sections, grid cards or list rows) so the
// switch from loading to loaded doesn't shift anything.
export function MenuItemsSkeleton({ mode }: { mode: MenuViewMode }) {
  return (
    <div className="space-y-8" role="status" aria-busy="true">
      <span className="sr-only">Loading menu…</span>
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section}>
          <Skeleton className="mb-3 h-5 w-32" />
          {mode === "grid" ? (
            <div className={gridClassName}>
              {Array.from({ length: 3 }).map((_, card) => (
                <Skeleton key={card} className="h-56 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {Array.from({ length: 3 }).map((_, row) => (
                <div key={row} className="flex items-center gap-3 px-3 py-3">
                  <Skeleton className="size-11 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
