import { describe, expect, it } from "vitest";
import { buildOwnerSignupEmail } from "../../../src/modules/auth/owner-signup.template.js";

const expiresAt = new Date("2026-11-26T12:00:00Z");

describe("buildOwnerSignupEmail", () => {
  it("carries the fragment link and the expiry in both bodies", () => {
    const email = buildOwnerSignupEmail({
      signupUrl: "https://app.example.com/signup/complete#token=abc123",
      expiresAt,
    });

    expect(email.subject).toContain("PlateFlow");
    expect(email.text).toContain(
      "https://app.example.com/signup/complete#token=abc123"
    );
    expect(email.text).toContain(expiresAt.toUTCString());
    expect(email.html).toContain(
      'href="https://app.example.com/signup/complete#token=abc123"'
    );
    expect(email.html).toContain(expiresAt.toUTCString());
  });

  it("does not disclose whether an account already exists", () => {
    const email = buildOwnerSignupEmail({
      signupUrl: "https://app.example.com/signup/complete#token=abc123",
      expiresAt,
    });

    expect(email.text).not.toMatch(/already|exists|registered/i);
  });
});
