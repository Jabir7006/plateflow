"use client"

import { useAuthStore } from "@/features/auth/store/auth-store"
import { canViewSalesReports } from "../permissions"

// Whether the signed-in user may see the sales summary. Gates the tiles on the
// history page so the request that backs them is never fired for a role the
// backend would 403 anyway.
export function useCanViewSalesReports(): boolean {
  const user = useAuthStore((state) => state.user)
  return user ? canViewSalesReports(user.role) : false
}
