import { signupVerifySchema } from "@plateflow/shared"

const tokenSchema = signupVerifySchema.shape.body.shape.token

/**
 * Reads the raw token from a URL fragment. An absent, malformed, or differently
 * named fragment yields null; the caller renders the broken-link state instead
 * of asking the API about a token that cannot exist.
 */
export function readSignupToken(hash: string): string | null {
  const raw = hash.startsWith("#token=") ? hash.slice("#token=".length) : ""
  const parsed = tokenSchema.safeParse(raw)

  return parsed.success ? parsed.data : null
}
