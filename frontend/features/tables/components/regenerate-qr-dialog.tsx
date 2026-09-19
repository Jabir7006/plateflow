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
import type { Table } from "../api"
import { useRegenerateTableQr } from "../hooks/use-table-mutations"

interface RegenerateQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table
}

// Rotating the token invalidates every printed sticker for this table, so this
// is a deliberate confirm — used when a code is compromised, not when a sticker
// is merely damaged (reprint the same code from View QR for that).
export function RegenerateQrDialog({
  open,
  onOpenChange,
  table,
}: RegenerateQrDialogProps) {
  const regenerate = useRegenerateTableQr()
  const isPending = regenerate.isPending

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) return
    if (!nextOpen) regenerate.reset()
    onOpenChange(nextOpen)
  }

  function confirmRegenerate() {
    // Errors (incl. a lost session) are handled in the mutation's onError.
    regenerate.mutate(table, { onSuccess: () => handleOpenChange(false) })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regenerate table {table.number} QR?</AlertDialogTitle>
          <AlertDialogDescription>
            This creates a new code and permanently disables the current one. Any
            sticker already printed for this table will stop working, so reprint
            it after. Only do this if the code was leaked or misused.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={confirmRegenerate}>
            {isPending ? "Regenerating…" : "Regenerate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
