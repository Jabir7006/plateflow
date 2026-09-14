"use client"

import { create } from "zustand"
import type { AuthUser } from "@plateflow/shared"

export type AuthStatus =
  "idle" | "loading" | "authenticated" | "unauthenticated" | "error"

interface AuthState {
  user: AuthUser | null
  status: AuthStatus
  error: string | null
  setLoading: () => void
  setUser: (user: AuthUser) => void
  setUnauthenticated: () => void
  setError: (message: string) => void
  reset: () => void
}

const signedOutState = {
  user: null,
  status: "unauthenticated" as const,
  error: null,
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",
  error: null,
  setLoading: () => set({ status: "loading", error: null }),
  setUser: (user) => set({ user, status: "authenticated", error: null }),
  setUnauthenticated: () => set(signedOutState),
  setError: (message) => set({ user: null, status: "error", error: message }),
  reset: () => set(signedOutState),
}))
