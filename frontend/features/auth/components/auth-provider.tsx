"use client"

import { useCallback, useEffect } from "react"
import { getErrorMessage } from "@/lib/api-error"
import { isTerminalAuthError, restoreSession } from "../api"
import { useAuthStore } from "../store/auth-store"

let pendingRestore: Promise<void> | null = null
let activeRestoreAttempt = 0

function isRestoreStillActive(attempt: number): boolean {
  return (
    activeRestoreAttempt === attempt &&
    useAuthStore.getState().status === "loading"
  )
}

async function restoreAuthState(): Promise<void> {
  const attempt = ++activeRestoreAttempt
  useAuthStore.getState().setLoading()

  try {
    const user = await restoreSession()

    // A login/logout or a newer restore wins over this old response.
    if (!isRestoreStillActive(attempt)) return

    useAuthStore.getState().setUser(user)
  } catch (error) {
    // Do not let a stale failure overwrite a newer auth state.
    if (!isRestoreStillActive(attempt)) return

    if (isTerminalAuthError(error)) {
      useAuthStore.getState().setUnauthenticated()
      return
    }

    useAuthStore
      .getState()
      .setError(getErrorMessage(error) ?? "Unable to verify your session")
  }
}

export function initializeAuth(): Promise<void> {
  if (!pendingRestore) {
    pendingRestore = restoreAuthState().finally(() => {
      pendingRestore = null
    })
  }

  return pendingRestore
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((state) => state.status)

  const initialize = useCallback(() => {
    void initializeAuth()
  }, [])

  useEffect(() => {
    if (status === "idle") initialize()
  }, [initialize, status])

  return children
}
