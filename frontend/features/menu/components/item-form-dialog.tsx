"use client"

import { useEffect, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createMenuItemSchema } from "@plateflow/shared"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage } from "@/lib/api-error"
import { extractFieldErrors } from "@/lib/api-field-errors"
import { ImageUploadError } from "../hooks/use-menu-item-mutations"
import type { MenuCategory, MenuItem, UpdateItemInput } from "../api"
import { useMenuCategories } from "../hooks/use-menu-categories"
import {
  useCreateMenuItem,
  useUpdateMenuItem,
} from "../hooks/use-menu-item-mutations"
import { ImagePicker } from "./image-picker"

// The shared body schema drives validation. Its `price` accepts a string and
// transforms to a number, so the form's input and output types differ — hence
// the three useForm generics below.
const itemFormSchema = createMenuItemSchema.shape.body
type FormInput = z.input<typeof itemFormSchema>
type FormOutput = z.output<typeof itemFormSchema>

// Fields we map server errors back onto.
const FIELD_NAMES = ["name", "price", "description", "categoryId"] as const

const fieldClassName =
  "h-10 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
const footerClassName = "flex-row gap-2 border-0 bg-transparent"

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Present means edit; absent means create.
  item?: MenuItem
  // Prefills the category on create (e.g. adding within a category section).
  defaultCategoryId?: string
}

export function ItemFormDialog({
  open,
  onOpenChange,
  item,
  defaultCategoryId,
}: ItemFormDialogProps) {
  const isEdit = Boolean(item)
  const create = useCreateMenuItem()
  const update = useUpdateMenuItem()
  const mutation = isEdit ? update : create
  const isPending = mutation.isPending

  const { data: categories } = useMenuCategories()

  // The image is tracked outside the schema (separate endpoint): File to
  // set/replace, null to remove, undefined to leave as-is.
  const [image, setImage] = useState<File | null | undefined>(undefined)

  const buildDefaults = (): FormInput => ({
    name: item?.name ?? "",
    // The input side is a string; an existing price is shown as typed text.
    price: item ? String(item.price) : "",
    description: item?.description ?? "",
    categoryId: item?.categoryId ?? defaultCategoryId ?? "",
    isAvailable: item?.isAvailable ?? true,
  })

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: buildDefaults(),
  })

  // Seed on the open transition only, so a background refetch handing down a
  // new `item` object can't wipe an edit in progress.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset(buildDefaults())
      setImage(undefined)
    }
    wasOpen.current = open
    // buildDefaults reads item/defaultCategoryId, intentionally seeded only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) return
    if (!nextOpen) mutation.reset()
    onOpenChange(nextOpen)
  }

  function onValidSubmit(values: FormOutput) {
    const onError = (error: unknown) => {
      // A saved-item-but-failed-image already reported itself via toast in the
      // mutation; close so the user isn't stuck on a form whose item saved.
      if (error instanceof ImageUploadError) {
        handleOpenChange(false)
        return
      }
      for (const { field, message } of extractFieldErrors(error, FIELD_NAMES)) {
        setError(field as (typeof FIELD_NAMES)[number], { message })
      }
    }
    const onSuccess = () => {
      reset(buildDefaults())
      setImage(undefined)
      handleOpenChange(false)
    }

    if (item) {
      // Nothing touched — no field is dirty and the image wasn't changed — so a
      // save would be a no-op PATCH with a misleading "updated" toast. Just close.
      if (!isDirty && image === undefined) {
        handleOpenChange(false)
        return
      }
      // Send only what changed. `dirtyFields` marks the touched keys; copy just
      // those from the validated output so the PATCH stays minimal.
      const input: UpdateItemInput = {}
      if (dirtyFields.name) input.name = values.name
      if (dirtyFields.price) input.price = values.price
      if (dirtyFields.description) input.description = values.description
      if (dirtyFields.categoryId) input.categoryId = values.categoryId
      if (dirtyFields.isAvailable) input.isAvailable = values.isAvailable
      update.mutate({ item, input, image }, { onSuccess, onError })
    } else {
      // On create there is no removal, only an optional file.
      create.mutate(
        { input: values, image: image ?? undefined },
        { onSuccess, onError }
      )
    }
  }

  const hasMappedFieldErrors =
    extractFieldErrors(mutation.error, FIELD_NAMES).length > 0
  const errorMessage =
    mutation.isError &&
    !hasMappedFieldErrors &&
    !(mutation.error instanceof ImageUploadError)
      ? getErrorMessage(mutation.error)
      : null

  const categoryOptions: MenuCategory[] = categories ?? []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit item" : "New item"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit
              ? "Update this menu item's details."
              : "Add a dish to your menu."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit(onValidSubmit)}
        >
          <div className="space-y-2">
            <Label htmlFor="item-name" className="text-sm font-normal">
              Name
            </Label>
            <Input
              id="item-name"
              autoFocus
              placeholder="Margherita"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              className={fieldClassName}
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-price" className="text-sm font-normal">
                Price
              </Label>
              <Input
                id="item-price"
                inputMode="decimal"
                placeholder="250"
                autoComplete="off"
                aria-invalid={Boolean(errors.price)}
                className={fieldClassName}
                {...register("price")}
              />
              {errors.price ? (
                <p className="text-sm text-destructive">
                  {errors.price.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-category" className="text-sm font-normal">
                Category
              </Label>
              <Controller
                control={control}
                name="categoryId"
                render={({ field: { value, onChange } }) => (
                  <Select
                    value={value || null}
                    disabled={isPending}
                    onValueChange={(next) => {
                      if (next !== null) onChange(next)
                    }}
                  >
                    <SelectTrigger
                      id="item-category"
                      aria-invalid={Boolean(errors.categoryId)}
                      className="h-10 w-full border-border bg-background"
                    >
                      <SelectValue placeholder="Choose">
                        {(selected: string | null) =>
                          categoryOptions.find((c) => c.id === selected)?.name ??
                          null
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoryId ? (
                <p className="text-sm text-destructive">
                  {errors.categoryId.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-description" className="text-sm font-normal">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="item-description"
              placeholder="Short description shown on the menu."
              aria-invalid={Boolean(errors.description)}
              {...register("description")}
            />
            {errors.description ? (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-normal">Photo</Label>
            <ImagePicker
              existingUrl={item?.imageUrl ?? null}
              value={image}
              onChange={setImage}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Available</p>
              <p className="text-xs text-muted-foreground">
                Unavailable items stay hidden from customers.
              </p>
            </div>
            <Controller
              control={control}
              name="isAvailable"
              render={({ field: { value, onChange } }) => (
                <Switch
                  checked={value ?? true}
                  disabled={isPending}
                  onCheckedChange={onChange}
                  aria-label="Available"
                />
              )}
            />
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
                  : "Adding…"
                : isEdit
                  ? "Save"
                  : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
