"use client"

import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createMenuCategorySchema } from "@plateflow/shared"
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
import type { MenuCategory } from "../api"
import {
  useCreateMenuCategory,
  useUpdateMenuCategory,
} from "../hooks/use-menu-category-mutations"

// Create and edit share one schema (both validate a single `name`).
const categoryFormSchema = createMenuCategorySchema.shape.body
type CategoryFormValues = { name: string }

const fieldClassName =
  "h-10 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"

const footerClassName = "flex-row gap-2 border-0 bg-transparent"

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Present means edit; absent means create.
  category?: MenuCategory
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: CategoryFormDialogProps) {
  const isEdit = Boolean(category)
  const create = useCreateMenuCategory()
  const update = useUpdateMenuCategory()
  const mutation = isEdit ? update : create
  const isPending = mutation.isPending

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: category?.name ?? "" },
  })

  // Seed the field only on the open transition, not on every render where
  // `category` changes. A background refetch (React Query refetches on window
  // focus) hands down a new category object with the same id; resetting then
  // would wipe an edit in progress. Reopening still reseeds from the latest
  // name because `category` is read fresh when the effect runs.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset({ name: category?.name ?? "" })
    }
    wasOpen.current = open
  }, [open, category, reset])

  // Every exit funnels through here: a pending request is not orphaned by a
  // close, and a failed one never survives to greet the next open.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) return
    if (!nextOpen) mutation.reset()
    onOpenChange(nextOpen)
  }

  function onValidSubmit(values: CategoryFormValues) {
    const onError = (error: unknown) => {
      if (handleUnauthorized(error)) return
      // Duplicate-name and other field errors map onto the input; anything
      // else falls through to the banner below.
      for (const { field, message } of extractFieldErrors(error, ["name"])) {
        setError(field as "name", { message })
      }
    }
    const onSuccess = () => {
      reset({ name: "" })
      handleOpenChange(false)
    }

    if (category) {
      update.mutate({ id: category.id, input: values }, { onSuccess, onError })
    } else {
      create.mutate(values, { onSuccess, onError })
    }
  }

  // Inline field errors win; the banner only speaks when nothing mapped.
  const hasMappedFieldErrors =
    extractFieldErrors(mutation.error, ["name"]).length > 0
  const errorMessage =
    mutation.isError && !hasMappedFieldErrors
      ? getErrorMessage(mutation.error)
      : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rename category" : "New category"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit
              ? "Change this menu category's name."
              : "Add a category to organize your menu."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit(onValidSubmit)}
        >
          <div className="space-y-2">
            <Label
              htmlFor="category-name"
              className="text-sm font-normal text-foreground"
            >
              Name
            </Label>
            <Input
              id="category-name"
              autoFocus
              placeholder="Starters"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              className={fieldClassName}
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-sm text-destructive">{errors.name.message}</p>
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
