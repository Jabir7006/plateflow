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
import { countLabel } from "@/lib/count-label"
import type { Table } from "../api"
import { useDeleteTable } from "../hooks/use-table-mutations"

interface DeleteTableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table
}

export function DeleteTableDialog({
  open,
  onOpenChange,
  table,
}: DeleteTableDialogProps) {
  const remove = useDeleteTable()
  const isPending = remove.isPending

  // The backend refuses to delete a table that still has orders (a 409). The
  // same guard here turns that into a clear explanation instead of a failed
  // request, and the count comes straight from the card so it needs no lookup.
  const hasOrders = table.orderCount > 0

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) return
    if (!nextOpen) remove.reset()
    onOpenChange(nextOpen)
  }

  function confirmDelete() {
    // Errors (incl. a lost session) are handled in the mutation's onError.
    remove.mutate(table, { onSuccess: () => handleOpenChange(false) })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete table {table.number}?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasOrders
              ? `This table has ${countLabel(
                  table.orderCount,
                  "order"
                )}, so it can't be deleted.`
              : "This removes the table and its QR code from your floor and can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={hasOrders || isPending}
            onClick={confirmDelete}
          >
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
