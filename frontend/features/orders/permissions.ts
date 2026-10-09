import type { Role } from "@plateflow/shared"

// Mirrors the backend guard on GET /orders/stats (order.staff.routes): the sales
// summary — revenue and per-status money totals — is management-only. The backend
// stays the enforcement authority; this only decides whether the UI offers it.
export function canViewSalesReports(role: Role): boolean {
  return role === "OWNER" || role === "MANAGER"
}
