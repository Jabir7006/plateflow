"use client"

import { create } from "zustand"
import type { AuthUser } from "@plateflow/shared"

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  setUser: (user: AuthUser | null) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: Boolean(user) }),
  reset: () => set({ user: null, isAuthenticated: false }),
}))
