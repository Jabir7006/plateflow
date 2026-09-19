"use client"

import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/api-error"
import { useMenuCategories } from "../hooks/use-menu-categories"
import { useCanManageMenu } from "../hooks/use-can-manage-menu"
import { CategoryListSkeleton } from "./category-list-skeleton"
import { CategoryRow } from "./category-row"

// A vertical list rather than cards: this renders inside the manage-categories
// dialog, where a row per category reads far better than a grid.
export function CategoryList() {
  const canManage = useCanManageMenu()
  const { data, isPending, isError, error, refetch, isFetching } =
    useMenuCategories()

  if (isPending) {
    return <CategoryListSkeleton />
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-dashed py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {getErrorMessage(error) ?? "We couldn't load your categories."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-10 text-center">
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "No categories yet. Add your first one above."
            : "No categories yet."}
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y rounded-lg border">
      {data.map((category) => (
        <CategoryRow
          key={category.id}
          category={category}
          canManage={canManage}
        />
      ))}
    </ul>
  )
}
