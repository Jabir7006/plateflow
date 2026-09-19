"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { MenuCategory } from "../api"
import { countLabel } from "@/lib/count-label"
import { useDeleteMenuCategory } from "../hooks/use-menu-category-mutations"

interface DeleteCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: MenuCategory
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  category,
}: DeleteCategoryDialogProps) {
  const remove = useDeleteMenuCategory()
  const isPending = remove.isPending

  // The backend refuses to delete a category that still has items (a 409). The
  // same guard here turns that into a clear explanation instead of a failed
  // request, and the count comes straight from the row so it needs no lookup.
  const hasItems = category.itemCount > 0

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) return
    if (!nextOpen) remove.reset()
    onOpenChange(nextOpen)
  }

  function confirmDelete() {
    // Errors (incl. a lost session) are handled in the mutation's onError.
    remove.mutate(category, {
      onSuccess: () => handleOpenChange(false),
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{category.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasItems
              ? `This category still has ${countLabel(
                  category.itemCount,
                  "item"
                )}. Move or remove them before deleting it.`
              : "This removes the category from your menu and can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={hasItems || isPending}
            onClick={confirmDelete}
          >
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
