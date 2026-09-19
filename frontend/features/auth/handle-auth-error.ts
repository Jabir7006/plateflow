import { ApiError } from "@/lib/api-client"
import { useAuthStore } from "./store/auth-store"

// A 401 means the session died mid-action. Handing the store to ProtectedRoute
// routes to login with a return path, instead of leaving the user retrying
// against a dead session. Returns true when it handled the error, so a caller
// can stop its own error handling (field mapping, toasts) after calling it.
export function handleUnauthorized(error: unknown): boolean {
  if (error instanceof ApiError && error.statusCode === 401) {
    useAuthStore.getState().setUnauthenticated()
    return true
  }

  return false
}
