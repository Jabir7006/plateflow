import type {
  CreateMenuCategorySchema,
  MenuCategory,
  MenuItem,
  UpdateMenuCategorySchema,
} from "@plateflow/shared"
import { apiRequest } from "@/lib/api-client"

export type { MenuCategory, MenuItem }
export type CreateCategoryInput = CreateMenuCategorySchema["body"]
export type UpdateCategoryInput = UpdateMenuCategorySchema["body"]

// Public read: the same list the customer menu is built from, so it carries no
// mutation and needs no role.
export function listMenuCategories(): Promise<MenuCategory[]> {
  return apiRequest<MenuCategory[]>("/menu/categories")
}

// Public read too. The backend already sorts by category then name, so the
// order it returns is the order the menu renders in. An absent categoryId
// means every category.
export function listMenuItems(categoryId?: string): Promise<MenuItem[]> {
  const query = categoryId
    ? `?categoryId=${encodeURIComponent(categoryId)}`
    : ""
  return apiRequest<MenuItem[]>(`/menu/items${query}`)
}

export function createMenuCategory(
  input: CreateCategoryInput
): Promise<MenuCategory> {
  return apiRequest<MenuCategory>("/menu/categories", {
    method: "POST",
    body: input,
  })
}

export function updateMenuCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<MenuCategory> {
  return apiRequest<MenuCategory>(
    `/menu/categories/${encodeURIComponent(id)}`,
    { method: "PATCH", body: input }
  )
}

export function deleteMenuCategory(id: string): Promise<void> {
  return apiRequest<void>(`/menu/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}
