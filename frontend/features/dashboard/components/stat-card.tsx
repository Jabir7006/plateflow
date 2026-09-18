import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  valueClassName?: string
}

// Compact metric tile for the dashboard header row. `valueClassName` lets a
// stat opt into an accent color, e.g. out-of-stock renders red.
export function StatCard({ label, value, valueClassName }: StatCardProps) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight",
            valueClassName
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
