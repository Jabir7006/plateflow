"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/api-error"
import { handleUnauthorized } from "@/features/auth/handle-auth-error"
import {
  createMenuItem,
  deleteMenuItem,
  removeMenuItemImage,
  setMenuItemImage,
  updateMenuItem,
} from "../api"
import type { CreateItemInput, MenuItem, UpdateItemInput } from "../api"

// Every list query lives under this prefix; the whole menu cache (items and
// category counts) lives under ["menu"]. A broad invalidate refreshes the
// denormalised categoryName and category itemCount that a mutation can change.
const ITEMS_PREFIX = ["menu", "items"] as const
const MENU_PREFIX = ["menu"] as const

// The image lives behind a second request. When it fails, the item itself was
// still saved, so this is surfaced as its own outcome rather than a plain
// failure — the caller can close the form and point the user at "edit" to
// retry the photo.
export class ImageUploadError extends Error {
  constructor(
    public readonly item: MenuItem,
    cause: unknown
  ) {
    super("The item was saved, but its image could not be uploaded.")
    this.name = "ImageUploadError"
    this.cause = cause
  }
}

// What the form hands the mutations: the validated body plus the image, which
// is tracked outside the schema (it is a separate endpoint). `image` is a File
// to set/replace, null to remove (edit only), or undefined to leave as-is.
type ImageChange = File | null | undefined

interface CreateVariables {
  input: CreateItemInput
  image?: File
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient()

  return useMutation<MenuItem, Error, CreateVariables>({
    mutationFn: async ({ input, image }) => {
      const created = await createMenuItem(input)
      if (!image) return created

      try {
        return await setMenuItemImage(created.id, image)
      } catch (error) {
        // The item exists; only the photo failed.
        throw new ImageUploadError(created, error)
      }
    },
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: MENU_PREFIX })
      toast.add({
        type: "success",
        title: "Item added",
        description: `"${item.name}" was added to the menu.`,
      })
    },
    onError: (error) => {
      // A saved-item-but-failed-image is not a lost session; only a real 401 is.
      if (error instanceof ImageUploadError) {
        void queryClient.invalidateQueries({ queryKey: MENU_PREFIX })
        toast.add({
          type: "warning",
          title: "Image didn't upload",
          description: `"${error.item.name}" was saved. Add its photo from edit.`,
        })
        return
      }
      handleUnauthorized(error)
    },
  })
}

interface UpdateVariables {
  // The item being edited. Carried whole so an image-only change can skip the
  // PATCH (an empty body fails the "at least one field" rule) and still name the
  // item in the partial-success toast.
  item: MenuItem
  // Only the fields the user actually changed. May be empty when just the image
  // changed.
  input: UpdateItemInput
  // The image change, applied after the fields are patched.
  image: ImageChange
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient()

  return useMutation<MenuItem, Error, UpdateVariables>({
    mutationFn: async ({ item, input, image }) => {
      const saved =
        Object.keys(input).length > 0
          ? await updateMenuItem(item.id, input)
          : item

      if (image === undefined) return saved

      try {
        return image === null
          ? await removeMenuItemImage(item.id)
          : await setMenuItemImage(item.id, image)
      } catch (error) {
        throw new ImageUploadError(saved, error)
      }
    },
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: MENU_PREFIX })
      toast.add({
        type: "success",
        title: "Item updated",
        description: `"${item.name}" was saved.`,
      })
    },
    onError: (error) => {
      if (error instanceof ImageUploadError) {
        void queryClient.invalidateQueries({ queryKey: MENU_PREFIX })
        toast.add({
          type: "warning",
          title: "Image didn't update",
          description: `"${error.item.name}"'s photo couldn't be changed. Try again from edit.`,
        })
        return
      }
      handleUnauthorized(error)
    },
  })
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient()

  // Takes the whole item so the toast can name it after the row is gone.
  return useMutation<void, Error, MenuItem>({
    mutationFn: (item) => deleteMenuItem(item.id),
    onSuccess: (_data, item) => {
      void queryClient.invalidateQueries({ queryKey: MENU_PREFIX })
      toast.add({
        type: "success",
        title: "Item deleted",
        description: `"${item.name}" was removed from the menu.`,
      })
    },
    onError: (error) => {
      // No form field to attach to (an ordered item yields a 409), so the
      // reason is a toast. A dead session routes to login instead.
      if (handleUnauthorized(error)) return
      toast.add({
        type: "error",
        title: "Couldn't delete item",
        description: getErrorMessage(error) ?? "Please try again.",
      })
    },
  })
}

export function useToggleMenuItemAvailability() {
  const queryClient = useQueryClient()

  // Set one item's availability across every cached items query — it can appear
  // in the "all" list and a category-filtered one. Touching only the target row
  // means a concurrent toggle on a different item is never reverted.
  const setAvailability = (id: string, isAvailable: boolean) => {
    for (const [key, list] of queryClient.getQueriesData<MenuItem[]>({
      queryKey: ITEMS_PREFIX,
    })) {
      if (!list) continue
      queryClient.setQueryData(
        key,
        list.map((row) => (row.id === id ? { ...row, isAvailable } : row))
      )
    }
  }

  // Optimistic: the flip is instant and rolled back on this item alone if the
  // PATCH fails.
  return useMutation<MenuItem, Error, MenuItem>({
    mutationFn: (item) =>
      updateMenuItem(item.id, { isAvailable: !item.isAvailable }),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ITEMS_PREFIX })
      setAvailability(item.id, !item.isAvailable)
    },
    onError: (error, item) => {
      // Revert just this item back to where it started.
      setAvailability(item.id, item.isAvailable)

      if (handleUnauthorized(error)) return
      toast.add({
        type: "error",
        title: "Couldn't update availability",
        description: getErrorMessage(error) ?? "Please try again.",
      })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ITEMS_PREFIX })
    },
  })
}
