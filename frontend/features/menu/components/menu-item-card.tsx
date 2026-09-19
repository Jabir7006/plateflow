"use client"

import { Ellipsis, UtensilsCrossed } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { MenuItem } from "../api"
import { formatPrice } from "../format-price"
import { useToggleMenuItemAvailability } from "../hooks/use-menu-item-mutations"
import { MenuItemActions } from "./menu-item-actions"

interface MenuItemCardProps {
  item: MenuItem
  canManage: boolean
}

export function MenuItemCard({ item, canManage }: MenuItemCardProps) {
  const toggle = useToggleMenuItemAvailability()

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

        {canManage ? (
          <MenuItemActions
            item={item}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${item.name}`}
                className="absolute top-2 right-2 bg-background/80 backdrop-blur hover:bg-background"
              >
                <Ellipsis />
              </Button>
            }
          />
        ) : null}
      </div>

      <CardContent className="space-y-2 py-3">
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

        {canManage ? (
          <label className="flex items-center justify-between gap-2 border-t pt-2 text-sm">
            <span className="text-muted-foreground">
              {item.isAvailable ? "In stock" : "Out of stock"}
            </span>
            <Switch
              size="sm"
              checked={item.isAvailable}
              disabled={toggle.isPending}
              onCheckedChange={() => toggle.mutate(item)}
              aria-label={`${item.name} in stock`}
            />
          </label>
        ) : null}
      </CardContent>
    </Card>
  )
}
