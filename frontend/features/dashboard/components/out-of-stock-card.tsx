import type { DashboardSummary } from "@plateflow/shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface OutOfStockCardProps {
  outOfStock: DashboardSummary["outOfStock"]
}

export function OutOfStockCard({ outOfStock }: OutOfStockCardProps) {
  const remaining = outOfStock.count - outOfStock.items.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Out of stock</CardTitle>
      </CardHeader>
      <CardContent>
        {outOfStock.count === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Everything&apos;s available.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {outOfStock.items.map((item) => (
                <li
                  key={item.id}
                  className="py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  {item.name}
                </li>
              ))}
            </ul>
            {remaining > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                And {remaining} more {remaining === 1 ? "item" : "items"}.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
