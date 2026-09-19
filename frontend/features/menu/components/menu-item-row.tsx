import { Check, UtensilsCrossed } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MenuItem } from "../api"
import { formatPrice } from "../format-price"

interface MenuItemRowProps {
  item: MenuItem
}

// Read-only status for now: a real toggle and an edit action arrive with the
// item form. Kept as a plain indicator so it doesn't imply it's clickable yet.
function AvailabilityIndicator({ available }: { available: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-sm",
        available ? "text-foreground" : "text-destructive"
      )}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-[4px] border",
          available
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40"
        )}
      >
        {available ? <Check className="size-3" /> : null}
      </span>
      {available ? "In stock" : "Out of stock"}
    </span>
  )
}

export function MenuItemRow({ item }: MenuItemRowProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="size-11 shrink-0 overflow-hidden rounded-md bg-muted">
        {item.imageUrl ? (
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
            <UtensilsCrossed className="size-4 text-muted-foreground/50" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.name}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatPrice(item.price)}
        </p>
      </div>

      <AvailabilityIndicator available={item.isAvailable} />
    </div>
  )
}
