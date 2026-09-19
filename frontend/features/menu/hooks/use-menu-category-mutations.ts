"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { getErrorMessage } from "@/lib/api-error"
import { handleUnauthorized } from "@/features/auth/handle-auth-error"
import {
  createMenuCategory,
  deleteMenuCategory,
  updateMenuCategory,
} from "../api"
import type {
  CreateCategoryInput,
  MenuCategory,
  UpdateCategoryInput,
} from "../api"
import { menuCategoriesKey } from "./use-menu-categories"

// Field-level errors (a duplicate name) are left for the form to map onto its
// input, so create/update stay quiet on error and only celebrate success.

export function useCreateMenuCategory() {
  const queryClient = useQueryClient()

  return useMutation<MenuCategory, Error, CreateCategoryInput>({
    mutationFn: createMenuCategory,
    onSuccess: (category) => {
      void queryClient.invalidateQueries({ queryKey: menuCategoriesKey })
      toast.add({
        type: "success",
        title: "Category created",
        description: `"${category.name}" was added to the menu.`,
      })
    },
  })
}

interface UpdateCategoryVariables {
  id: string
  input: UpdateCategoryInput
}

export function useUpdateMenuCategory() {
  const queryClient = useQueryClient()

  return useMutation<MenuCategory, Error, UpdateCategoryVariables>({
    mutationFn: ({ id, input }) => updateMenuCategory(id, input),
    onSuccess: (category) => {
      void queryClient.invalidateQueries({ queryKey: menuCategoriesKey })
      toast.add({
        type: "success",
        title: "Category updated",
        description: `Renamed to "${category.name}".`,
      })
    },
  })
}

export function useDeleteMenuCategory() {
  const queryClient = useQueryClient()

  // Takes the whole category so the toast can name it after the row is gone.
  return useMutation<void, Error, MenuCategory>({
    mutationFn: (category) => deleteMenuCategory(category.id),
    onSuccess: (_data, category) => {
      void queryClient.invalidateQueries({ queryKey: menuCategoriesKey })
      toast.add({
        type: "success",
        title: "Category deleted",
        description: `"${category.name}" was removed from the menu.`,
      })
    },
    onError: (error) => {
      // No form field to attach to (a category with items yields a 409), so the
      // reason is surfaced as a toast. A dead session routes to login instead.
      if (handleUnauthorized(error)) return
      toast.add({
        type: "error",
        title: "Couldn't delete category",
        description: getErrorMessage(error) ?? "Please try again.",
      })
    },
  })
}
