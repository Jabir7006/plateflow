"use client"

import { useAuthStore } from "@/features/auth/store/auth-store"
import { canManageTables } from "../permissions"

// Whether the signed-in user may manage tables. Shared by the client islands
// (the header action and the grid) so they agree without each re-deriving it.
export function useCanManageTables(): boolean {
  const user = useAuthStore((state) => state.user)
  return user ? canManageTables(user.role) : false
}
