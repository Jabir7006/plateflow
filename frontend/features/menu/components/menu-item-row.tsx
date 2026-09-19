"use client"

import { Check, Ellipsis, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { MenuItem } from "../api"
import { formatPrice } from "../format-price"
import { useToggleMenuItemAvailability } from "../hooks/use-menu-item-mutations"
import { MenuItemActions } from "./menu-item-actions"

interface MenuItemRowProps {
  item: MenuItem
  canManage: boolean
}

// Read-only: a static indicator for viewers who cannot manage the menu.
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

// Manager view: the same control, now a checkbox that flips availability
// optimistically. Disabled only briefly while the PATCH is in flight.
function AvailabilityToggle({ item }: { item: MenuItem }) {
  const toggle = useToggleMenuItemAvailability()
  const available = item.isAvailable

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={available}
      aria-label={`${item.name} in stock`}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate(item)}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-sm transition-colors disabled:opacity-70",
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
    </button>
  )
}

export function MenuItemRow({ item, canManage }: MenuItemRowProps) {
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

      {canManage ? (
        <>
          <AvailabilityToggle item={item} />
          <MenuItemActions
            item={item}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${item.name}`}
              >
                <Ellipsis />
              </Button>
            }
          />
        </>
      ) : (
        <AvailabilityIndicator available={item.isAvailable} />
      )}
    </div>
  )
}
