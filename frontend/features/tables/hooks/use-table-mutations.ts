"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/api-error"
import { handleUnauthorized } from "@/features/auth/handle-auth-error"
import { createTable, deleteTable, regenerateTableQr, updateTable } from "../api"
import type { CreateTableInput, Table, UpdateTableInput } from "../api"
import { tablesKey } from "./use-tables"

// Field-level errors (a duplicate number) are left for the form to map onto its
// input, so create/update stay quiet on error and only celebrate success.

export function useCreateTable() {
  const queryClient = useQueryClient()

  return useMutation<Table, Error, CreateTableInput>({
    mutationFn: createTable,
    onSuccess: (table) => {
      void queryClient.invalidateQueries({ queryKey: tablesKey })
      toast.add({
        type: "success",
        title: "Table created",
        description: `Table ${table.number} was added.`,
      })
    },
  })
}

interface UpdateTableVariables {
  id: string
  input: UpdateTableInput
}

export function useUpdateTable() {
  const queryClient = useQueryClient()

  return useMutation<Table, Error, UpdateTableVariables>({
    mutationFn: ({ id, input }) => updateTable(id, input),
    onSuccess: (table) => {
      void queryClient.invalidateQueries({ queryKey: tablesKey })
      toast.add({
        type: "success",
        title: "Table updated",
        description: `Renumbered to ${table.number}.`,
      })
    },
  })
}

export function useDeleteTable() {
  const queryClient = useQueryClient()

  // Takes the whole table so the toast can name it after the card is gone.
  return useMutation<void, Error, Table>({
    mutationFn: (table) => deleteTable(table.id),
    onSuccess: (_data, table) => {
      void queryClient.invalidateQueries({ queryKey: tablesKey })
      toast.add({
        type: "success",
        title: "Table deleted",
        description: `Table ${table.number} was removed.`,
      })
    },
    onError: (error) => {
      // No form field to attach to (a table with orders yields a 409), so the
      // reason is surfaced as a toast. A dead session routes to login instead.
      if (handleUnauthorized(error)) return
      toast.add({
        type: "error",
        title: "Couldn't delete table",
        description: getErrorMessage(error) ?? "Please try again.",
      })
    },
  })
}

export function useRegenerateTableQr() {
  const queryClient = useQueryClient()

  return useMutation<Table, Error, Table>({
    mutationFn: (table) => regenerateTableQr(table.id),
    onSuccess: (table) => {
      void queryClient.invalidateQueries({ queryKey: tablesKey })
      toast.add({
        type: "success",
        title: "QR code regenerated",
        description: `Table ${table.number}'s old code no longer works.`,
      })
    },
    onError: (error) => {
      // No field to map onto; surface the reason as a toast. A dead session
      // routes to login instead.
      if (handleUnauthorized(error)) return
      toast.add({
        type: "error",
        title: "Couldn't regenerate QR code",
        description: getErrorMessage(error) ?? "Please try again.",
      })
    },
  })
}
