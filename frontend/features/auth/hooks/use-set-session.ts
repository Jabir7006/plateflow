"use client"

import { useQueryClient } from "@tanstack/react-query"
import type { AuthUser } from "@plateflow/shared"
import { useAuthStore } from "../store/auth-store"

// Staff query keys carry no tenant, and cached data outlives a session that
// ended without an explicit logout (a 401 leaves the cache in place). Adopting a
// new identity therefore has to drop it, or the next restaurant to sign in on
// this tab reads the previous one's orders, tables and menu for up to the
// 60s staleTime. Login and invite acceptance both come through here; the
// boot-time session restore does not need to, because it only runs on a fresh
// load, when the cache is already empty.
export function useSetSession() {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)

  return (user: AuthUser) => {
    queryClient.clear()
    setUser(user)
  }
}
