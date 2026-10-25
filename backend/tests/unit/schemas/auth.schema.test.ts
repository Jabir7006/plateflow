import { describe, expect, it } from "vitest";
import {
  acceptInviteSchema,
  inviteSchema,
  loginSchema,
  verifyInviteSchema,
} from "@plateflow/shared";

const messageOf = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("loginSchema", () => {
  it("normalises the email before the account lookup", () => {
    const parsed = loginSchema.parse({
      body: { email: "  Owner@Example.COM ", password: "secret123" },
    });

    expect(parsed.body.email).toBe("owner@example.com");
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      body: { email: "not-an-email", password: "secret123" },
    });

    expect(result.success).toBe(false);
    expect(messageOf(result)).toBe("Valid email is required");
  });

  it("rejects a password below the minimum length", () => {
    const result = loginSchema.safeParse({
      body: { email: "owner@example.com", password: "12345" },
    });

    expect(result.success).toBe(false);
    expect(messageOf(result)).toBe("Password must be at least 6 characters long");
  });

  it("accepts a password exactly at the minimum length", () => {
    expect(
      loginSchema.safeParse({
        body: { email: "owner@example.com", password: "123456" },
      }).success
    ).toBe(true);
  });
});

describe("inviteSchema", () => {
  it("trims the name and normalises the email", () => {
    const parsed = inviteSchema.parse({
      body: {
        fullName: "  Nadia Rahman ",
        email: " Nadia@Example.com ",
        role: "WAITER",
      },
    });

    expect(parsed.body).toEqual({
      fullName: "Nadia Rahman",
      email: "nadia@example.com",
      role: "WAITER",
    });
  });

  it("only accepts roles that can be invited", () => {
    for (const role of ["MANAGER", "CHEF", "WAITER"] as const) {
      expect(
        inviteSchema.safeParse({
          body: { fullName: "Nadia Rahman", email: "n@example.com", role },
        }).success
      ).toBe(true);
    }

    const result = inviteSchema.safeParse({
      body: { fullName: "Nadia Rahman", email: "n@example.com", role: "OWNER" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a one-character name", () => {
    const result = inviteSchema.safeParse({
      body: { fullName: "A", email: "n@example.com", role: "CHEF" },
    });

    expect(messageOf(result)).toBe("Name is too short");
  });
});

describe("acceptInviteSchema", () => {
  it("trims the token and applies the password rules", () => {
    const parsed = acceptInviteSchema.parse({
      body: { token: "  raw-token  ", password: "secret123" },
    });

    expect(parsed.body.token).toBe("raw-token");
  });

  it("rejects an empty token", () => {
    const result = acceptInviteSchema.safeParse({
      body: { token: "   ", password: "secret123" },
    });

    expect(result.success).toBe(false);
  });
});

describe("verifyInviteSchema", () => {
  it("requires the token in the query string", () => {
    expect(verifyInviteSchema.safeParse({ query: {} }).success).toBe(false);
    expect(
      verifyInviteSchema.safeParse({ query: { token: "abc" } }).success
    ).toBe(true);
  });
});
