import { Skeleton } from "@/components/ui/skeleton"
import { tablesGridClass } from "./grid-class"

// Card-shaped placeholders matching the loaded grid, so the switch from loading
// to loaded doesn't shift anything.
export function TablesSkeleton() {
  return (
    <div className={tablesGridClass} role="status" aria-busy="true">
      <span className="sr-only">Loading tables…</span>
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-28 rounded-xl" />
      ))}
    </div>
  )
}
