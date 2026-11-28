import { describe, expect, it } from "vitest"
import { ApiError } from "../../lib/api-client"
import { canRetrySignupVerification } from "./signup-retry"

describe("canRetrySignupVerification", () => {
  it("does not retry a rejected link", () => {
    expect(
      canRetrySignupVerification(
        new ApiError("This signup link is invalid or has expired.", 400)
      )
    ).toBe(false)
  })

  it("retries a server failure", () => {
    expect(
      canRetrySignupVerification(new ApiError("Something went wrong", 500))
    ).toBe(true)
  })

  it("retries a network failure", () => {
    expect(canRetrySignupVerification(new TypeError("fetch failed"))).toBe(true)
  })
})
