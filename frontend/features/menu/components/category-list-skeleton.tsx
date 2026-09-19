import { Skeleton } from "@/components/ui/skeleton"

// Row-shaped placeholders matching the loaded category list.
export function CategoryListSkeleton() {
  return (
    <ul className="divide-y rounded-lg border" role="status" aria-busy="true">
      <li className="sr-only">Loading categories…</li>
      {Array.from({ length: 4 }).map((_, index) => (
        <li key={index} className="flex items-center justify-between px-3 py-2.5">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="size-8 rounded-md" />
        </li>
      ))}
    </ul>
  )
}
