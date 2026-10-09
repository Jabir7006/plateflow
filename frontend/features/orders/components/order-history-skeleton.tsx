import { Skeleton } from "@/components/ui/skeleton"

// Mirrors the loaded table (header row + divide-y body) so the swap from loading
// to loaded doesn't shift the layout.
export function OrderHistorySkeleton() {
  return (
    <div
      className="overflow-hidden rounded-xl border"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading orders…</span>
      <div className="hidden grid-cols-[10rem_5rem_1fr_auto] gap-4 border-b bg-muted/40 px-4 py-2 sm:grid">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-24 justify-self-end" />
      </div>

      <div className="divide-y">
        {Array.from({ length: 8 }).map((_, row) => (
          <div
            key={row}
            className="flex flex-col gap-2 px-4 py-3 sm:grid sm:grid-cols-[10rem_5rem_1fr_auto] sm:items-center sm:gap-4"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-40" />
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
