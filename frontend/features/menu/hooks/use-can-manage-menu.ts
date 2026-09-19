"use client"

import { useAuthStore } from "@/features/auth/store/auth-store"
import { canManageMenu } from "../permissions"

// Whether the signed-in user may write the menu. Shared by the client islands
// (the header actions and the list) so they agree without each re-deriving it.
export function useCanManageMenu(): boolean {
  const user = useAuthStore((state) => state.user)
  return user ? canManageMenu(user.role) : false
}
