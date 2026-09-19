import type { Role } from "@plateflow/shared"

// Mirrors the backend policy (table.routes): table management is staff-only, and
// only the owner and managers may create, edit, or delete a table. The backend
// stays the enforcement authority; this only decides what the UI offers.
export function canManageTables(role: Role): boolean {
  return role === "OWNER" || role === "MANAGER"
}
