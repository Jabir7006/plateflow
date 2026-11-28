import { ApiError } from "../../lib/api-client"

/**
 * A 400 is the API saying the token itself is unknown, expired, or spent, so a
 * retry with the same token cannot help. Network failures and 5xx responses are
 * transient; the caller still holds the fragment token in memory and can retry
 * without a page reload.
 */
export function canRetrySignupVerification(error: unknown): boolean {
  return !(error instanceof ApiError && error.statusCode === 400)
}
