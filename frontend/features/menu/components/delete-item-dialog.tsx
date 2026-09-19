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
import type { MenuItem } from "../api"
import { useDeleteMenuItem } from "../hooks/use-menu-item-mutations"

interface DeleteItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MenuItem
}

export function DeleteItemDialog({
  open,
  onOpenChange,
  item,
}: DeleteItemDialogProps) {
  const remove = useDeleteMenuItem()
  const isPending = remove.isPending

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) return
    if (!nextOpen) remove.reset()
    onOpenChange(nextOpen)
  }

  function confirmDelete() {
    // An item that appears in past orders yields a 409, surfaced by the
    // mutation's onError toast; a lost session routes to login there too.
    remove.mutate(item, { onSuccess: () => handleOpenChange(false) })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{item.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the item from your menu and can&apos;t be undone. If
            it appears in past orders, mark it unavailable instead.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={confirmDelete}
          >
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
