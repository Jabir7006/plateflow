import { describe, expect, it } from "vitest"

import { readSignupToken } from "./signup-token"

const VALID = "A".repeat(42) + "z"

describe("readSignupToken", () => {
  it("returns the token from the expected fragment", () => {
    expect(readSignupToken(`#token=${VALID}`)).toBe(VALID)
  })

  it.each([
    "",
    "#",
    "#token=",
    "#token=short",
    "#access_token=abc",
    "#TOKEN=" + VALID,
    `#token=${VALID}x`,
    `#token=${"A".repeat(43)}=`,
  ])("rejects a missing or malformed fragment: %s", (hash) => {
    expect(readSignupToken(hash)).toBeNull()
  })

  it("accepts the base64url alphabet", () => {
    const token = "-_".repeat(21) + "A"
    expect(token).toHaveLength(43)
    expect(readSignupToken(`#token=${token}`)).toBe(token)
  })
})
