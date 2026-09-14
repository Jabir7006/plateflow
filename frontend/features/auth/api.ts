import type { AuthUser, LoginSchema } from "@plateflow/shared"
import { ApiError, apiRequest } from "@/lib/api-client"

export type LoginInput = LoginSchema["body"]

export async function loginUser(input: LoginInput): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/login", {
    method: "POST",
    body: input,
  })
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/me")
}

export function refreshSession(): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/refresh", { method: "POST" })
}

export function logoutUser(): Promise<null> {
  return apiRequest<null>("/auth/logout", { method: "POST" })
}

let refreshPromise: Promise<AuthUser> | null = null

function refreshSessionOnce(): Promise<AuthUser> {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

/**
 * The rotated cookies did not arrive inside the poll window. A 409 already proved
 * the session was live, so this is a timing failure rather than a dead session and
 * must stay retryable: reporting the poll's final 401 would sign out a user whose
 * credentials are still valid.
 */
export class SessionRotationPendingError extends Error {
  constructor() {
    super("Your session is still being renewed. Please try again.")
    this.name = "SessionRotationPendingError"
  }
}

/**
 * A 409 means a sibling request (usually another tab) already rotated the shared
 * refresh cookie, so this session is alive and its fresh cookies are on the way.
 * `Set-Cookie` is invisible to JavaScript, so the only way to know the browser
 * received them is for `/auth/me` to succeed. Poll it briefly instead of betting
 * on a single fixed delay: the winning request still does extra database work
 * after committing its rotation and before it writes cookies.
 *
 * The window only decides how often the user sees a retry prompt, never whether a
 * valid session survives, so it is sized for the common gap rather than the tail.
 */
const ROTATION_POLL_DELAYS = [150, 300, 600]

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForRotatedSession(): Promise<AuthUser> {
  for (const ms of ROTATION_POLL_DELAYS) {
    await wait(ms)

    try {
      return await getCurrentUser()
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 401) {
        throw error
      }
    }
  }

  throw new SessionRotationPendingError()
}

export async function restoreSession(): Promise<AuthUser> {
  try {
    return await getCurrentUser()
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 401) {
      throw error
    }

    try {
      return await refreshSessionOnce()
    } catch (refreshError) {
      if (refreshError instanceof ApiError && refreshError.statusCode === 409) {
        return waitForRotatedSession()
      }

      throw refreshError
    }
  }
}

export function isTerminalAuthError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.statusCode === 401 || error.statusCode === 403)
  )
}
