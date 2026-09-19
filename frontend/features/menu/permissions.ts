import type { Role } from "@plateflow/shared"

// Mirrors the backend policy (menu-category.routes): reading the menu is open,
// but only the owner and managers may create, rename, or delete a category.
// The backend stays the enforcement authority; this only decides what the UI
// offers.
export function canManageMenu(role: Role): boolean {
  return role === "OWNER" || role === "MANAGER"
}
