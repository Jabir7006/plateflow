"use client"

import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createTableSchema } from "@plateflow/shared"
import type { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getErrorMessage } from "@/lib/api-error"
import { extractFieldErrors } from "@/lib/api-field-errors"
import { handleUnauthorized } from "@/features/auth/handle-auth-error"
import type { Table } from "../api"
import { useCreateTable, useUpdateTable } from "../hooks/use-table-mutations"

// Create and edit share one schema (both validate a single `number`). Its
// `number` accepts a string and transforms to a number, so the form's input and
// output types differ — hence the three useForm generics below.
const tableFormSchema = createTableSchema.shape.body
type FormInput = z.input<typeof tableFormSchema>
type FormOutput = z.output<typeof tableFormSchema>

const fieldClassName =
  "h-10 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"

const footerClassName = "flex-row gap-2 border-0 bg-transparent"

interface TableFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Present means edit; absent means create.
  table?: Table
}

export function TableFormDialog({
  open,
  onOpenChange,
  table,
}: TableFormDialogProps) {
  const isEdit = Boolean(table)
  const create = useCreateTable()
  const update = useUpdateTable()
  const mutation = isEdit ? update : create
  const isPending = mutation.isPending

  // The input side is a string (the raw text of the field); an existing number
  // is shown as typed text.
  const buildDefaults = (): FormInput => ({
    number: table ? String(table.number) : "",
  })

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(tableFormSchema),
    defaultValues: buildDefaults(),
  })

  // Seed the field only on the open transition, so a background refetch handing
  // down a new `table` object can't wipe an edit in progress.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset(buildDefaults())
    }
    wasOpen.current = open
    // buildDefaults reads `table`, intentionally seeded only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) return
    if (!nextOpen) mutation.reset()
    onOpenChange(nextOpen)
  }

  function onValidSubmit(values: FormOutput) {
    const onError = (error: unknown) => {
      if (handleUnauthorized(error)) return
      // Duplicate-number and other field errors map onto the input; anything
      // else falls through to the banner below.
      for (const { field, message } of extractFieldErrors(error, ["number"])) {
        setError(field as "number", { message })
      }
    }
    const onSuccess = () => {
      reset(buildDefaults())
      handleOpenChange(false)
    }

    if (table) {
      update.mutate({ id: table.id, input: values }, { onSuccess, onError })
    } else {
      create.mutate(values, { onSuccess, onError })
    }
  }

  // Inline field errors win; the banner only speaks when nothing mapped.
  const hasMappedFieldErrors =
    extractFieldErrors(mutation.error, ["number"]).length > 0
  const errorMessage =
    mutation.isError && !hasMappedFieldErrors
      ? getErrorMessage(mutation.error)
      : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit table" : "New table"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit
              ? "Change this table's number."
              : "Add a table to your floor."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit(onValidSubmit)}
        >
          <div className="space-y-2">
            <Label
              htmlFor="table-number"
              className="text-sm font-normal text-foreground"
            >
              Number
            </Label>
            <Input
              id="table-number"
              autoFocus
              inputMode="numeric"
              placeholder="12"
              autoComplete="off"
              aria-invalid={Boolean(errors.number)}
              className={fieldClassName}
              {...register("number")}
            />
            {errors.number ? (
              <p className="text-sm text-destructive">
                {errors.number.message}
              </p>
            ) : null}
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </p>
          ) : null}

          <DialogFooter className={footerClassName}>
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-10 flex-1" disabled={isPending}>
              {isPending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save"
                  : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
