import { UtensilsCrossed } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { MenuItem } from "../api"
import { formatPrice } from "../format-price"

interface MenuItemCardProps {
  item: MenuItem
}

// Read-only for now: photo, name, price, and a one-glance availability cue.
// Editing arrives with the item form in the next step.
export function MenuItemCard({ item }: MenuItemCardProps) {
  return (
    <Card className="gap-0 py-0">
      <div className="relative aspect-4/3 bg-muted">
        {item.imageUrl ? (
          // Plain img on purpose: the source is a remote Cloudinary URL and a
          // fixed aspect ratio already reserves the space, so there is no layout
          // shift and nothing to configure. lazy + async keeps it off the
          // critical path.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className={cn(
              "h-full w-full object-cover",
              !item.isAvailable && "opacity-50"
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="size-7 text-muted-foreground/40" />
          </div>
        )}

        {!item.isAvailable ? (
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 bg-background/80 backdrop-blur"
          >
            Unavailable
          </Badge>
        ) : null}
      </div>

      <CardContent className="space-y-1 py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate font-medium">{item.name}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {formatPrice(item.price)}
          </p>
        </div>
        {item.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {item.description}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
