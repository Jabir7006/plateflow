import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardMetricsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard metrics"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="gap-1 py-4">
          <CardContent className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function DashboardCardSkeleton({ label }: { label: string }) {
  return (
    <Card role="status" aria-busy="true" aria-label={label}>
      <CardHeader>
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </CardContent>
    </Card>
  )
}
