"use client"

import { useMemo } from "react"
import { UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getErrorMessage } from "@/lib/api-error"
import { useMenuItems } from "../hooks/use-menu-items"
import { useMenuViewMode } from "../hooks/use-menu-view-mode"
import { useCanManageMenu } from "../hooks/use-can-manage-menu"
import { groupByCategory, type MenuItemGroup } from "../group-items"
import { MenuItemCard } from "./menu-item-card"
import { MenuItemRow } from "./menu-item-row"
import { MenuItemsSkeleton } from "./menu-items-skeleton"
import { MenuViewToggle } from "./menu-view-toggle"

const gridClassName = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"

function CategoryHeading({ group }: { group: MenuItemGroup }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="font-heading text-base font-medium">
        {group.categoryName}
      </h2>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
        {group.items.length}
      </span>
    </div>
  )
}

export function MenuItemsList() {
  const { mode } = useMenuViewMode()
  const canManage = useCanManageMenu()
  const { data, isPending, isError, error, refetch, isFetching } =
    useMenuItems()

  // Grouping is cheap, but the list re-renders on every query state tick, so it
  // only re-runs when the data itself changes.
  const groups = useMemo(() => (data ? groupByCategory(data) : []), [data])

  if (isPending) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <MenuViewToggle />
        </div>
        <MenuItemsSkeleton mode={mode} />
      </div>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {getErrorMessage(error) ?? "We couldn't load the menu."}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="mb-1 inline-flex size-11 items-center justify-center rounded-full bg-muted">
            <UtensilsCrossed className="size-5 text-muted-foreground" />
          </div>
          <p className="font-medium">No menu items yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Set up your categories, then add dishes to build out the menu.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <MenuViewToggle />
      </div>

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.categoryId} aria-label={group.categoryName}>
            <CategoryHeading group={group} />

            {mode === "grid" ? (
              <div className={gridClassName}>
                {group.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    canManage={canManage}
                  />
                ))}
              </div>
            ) : (
              <div className="divide-y rounded-xl border">
                {group.items.map((item) => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    canManage={canManage}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
