import type {
  CreateMenuCategorySchema,
  CreateMenuItemSchema,
  MenuCategory,
  MenuItem,
  UpdateMenuCategorySchema,
  UpdateMenuItemSchema,
} from "@plateflow/shared"
import { apiRequest } from "@/lib/api-client"

export type { MenuCategory, MenuItem }
export type CreateCategoryInput = CreateMenuCategorySchema["body"]
export type UpdateCategoryInput = UpdateMenuCategorySchema["body"]
export type CreateItemInput = CreateMenuItemSchema["body"]
export type UpdateItemInput = UpdateMenuItemSchema["body"]

// The multipart field name the upload endpoint expects (backend
// MENU_ITEM_IMAGE_FIELD).
const IMAGE_FIELD = "image"

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

export function createMenuItem(input: CreateItemInput): Promise<MenuItem> {
  return apiRequest<MenuItem>("/menu/items", { method: "POST", body: input })
}

export function updateMenuItem(
  id: string,
  input: UpdateItemInput
): Promise<MenuItem> {
  return apiRequest<MenuItem>(`/menu/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  })
}

export function deleteMenuItem(id: string): Promise<void> {
  return apiRequest<void>(`/menu/items/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

// Separate multipart endpoint: the file rides in FormData, which apiRequest
// forwards untouched so the browser sets the multipart boundary.
export function setMenuItemImage(id: string, file: File): Promise<MenuItem> {
  const form = new FormData()
  form.append(IMAGE_FIELD, file)
  return apiRequest<MenuItem>(`/menu/items/${encodeURIComponent(id)}/image`, {
    method: "PUT",
    body: form,
  })
}

export function removeMenuItemImage(id: string): Promise<MenuItem> {
  return apiRequest<MenuItem>(`/menu/items/${encodeURIComponent(id)}/image`, {
    method: "DELETE",
  })
}
