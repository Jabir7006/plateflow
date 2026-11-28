import { describe, expect, it } from "vitest"

import {
  DEFAULT_AUTHENTICATED_ROUTE,
  getSafeReturnPath,
} from "./redirects"

describe("getSafeReturnPath", () => {
  it.each([
    null,
    "",
    "dashboard",
    "https://evil.example/orders",
    "//evil.example/orders",
  ])("rejects an external or empty value: %s", (value) => {
    expect(getSafeReturnPath(value)).toBe(DEFAULT_AUTHENTICATED_ROUTE)
  })

  it.each([
    "/login",
    "/login/",
    "/signup",
    "/signup/",
    "/signup/complete",
    "/signup/complete?token=abc",
  ])("keeps a guest-only screen out of the return target: %s", (value) => {
    expect(getSafeReturnPath(value)).toBe(DEFAULT_AUTHENTICATED_ROUTE)
  })

  it("keeps an internal path with its query and hash", () => {
    expect(getSafeReturnPath("/orders?status=OPEN#today")).toBe(
      "/orders?status=OPEN#today"
    )
  })

  it("does not treat a lookalike prefix as a guest path", () => {
    expect(getSafeReturnPath("/signup-history")).toBe("/signup-history")
  })

  it("only accepts relative paths, even on the same origin", () => {
    expect(
      getSafeReturnPath("http://plateflow.local/tables?view=grid")
    ).toBe(DEFAULT_AUTHENTICATED_ROUTE)
  })
})
