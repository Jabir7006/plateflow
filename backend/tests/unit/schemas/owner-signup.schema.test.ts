import { describe, expect, it } from "vitest";
import {
  signupCompleteSchema,
  signupRequestSchema,
  signupVerifySchema,
} from "@plateflow/shared";
import { isValidTimeZone } from "../../../src/lib/reporting-period.js";

const messageOf = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

const token = "A".repeat(43);

const completeBody = (overrides: Record<string, unknown> = {}) => ({
  body: {
    token,
    restaurantName: "Spice Garden",
    timeZone: "Asia/Dhaka",
    ownerName: "Asha Rahman",
    password: "correct horse battery",
    ...overrides,
  },
});

describe("signupRequestSchema", () => {
  it("trims and lower-cases the email before it is stored", () => {
    const parsed = signupRequestSchema.parse({
      body: { email: "  Owner@Example.COM " },
    });

    expect(parsed.body.email).toBe("owner@example.com");
  });

  it("rejects an invalid email", () => {
    const result = signupRequestSchema.safeParse({
      body: { email: "not-an-email" },
    });

    expect(result.success).toBe(false);
    expect(messageOf(result)).toBe("Valid email is required");
  });

  it("caps the address at 254 characters", () => {
    const tooLong = `${"a".repeat(243)}@example.com`; // 255 characters
    expect(tooLong).toHaveLength(255);

    const result = signupRequestSchema.safeParse({ body: { email: tooLong } });

    expect(result.success).toBe(false);
    expect(messageOf(result)).toBe("Email must be at most 254 characters");
  });

  it("rejects client-supplied fields", () => {
    const result = signupRequestSchema.safeParse({
      body: { email: "owner@example.com", role: "OWNER" },
    });

    expect(result.success).toBe(false);
  });
});

describe("signupVerifySchema", () => {
  it("accepts the 43-character base64url token randomId(32) produces", () => {
    expect(signupVerifySchema.safeParse({ body: { token } }).success).toBe(true);
    expect(
      signupVerifySchema.safeParse({ body: { token: "abc-DEF_123".padEnd(43, "x") } })
        .success
    ).toBe(true);
  });

  it("rejects tokens that are the wrong length or contain other characters", () => {
    for (const candidate of ["A".repeat(42), "A".repeat(44), "!".repeat(43), " "]) {
      const result = signupVerifySchema.safeParse({ body: { token: candidate } });
      expect(result.success, candidate).toBe(false);
      expect(messageOf(result)).toBe("Signup link is invalid");
    }
  });
});

describe("signupCompleteSchema", () => {
  it("trims names and the timezone while preserving password whitespace", () => {
    const parsed = signupCompleteSchema.parse(
      completeBody({
        restaurantName: "  Spice Garden  ",
        timeZone: "  Asia/Dhaka  ",
        ownerName: "  Asha Rahman  ",
        password: "  correct horse battery  ",
      })
    );

    expect(parsed.body).toEqual({
      token,
      restaurantName: "Spice Garden",
      timeZone: "Asia/Dhaka",
      ownerName: "Asha Rahman",
      password: "  correct horse battery  ",
    });
  });

  it("bounds the restaurant name to 2-120 characters after trimming", () => {
    expect(
      messageOf(signupCompleteSchema.safeParse(completeBody({ restaurantName: " A " })))
    ).toBe("Restaurant name is too short");
    expect(
      messageOf(
        signupCompleteSchema.safeParse(
          completeBody({ restaurantName: "a".repeat(121) })
        )
      )
    ).toBe("Restaurant name must be at most 120 characters");
  });

  it("bounds the owner name to 2-100 characters after trimming", () => {
    expect(
      messageOf(signupCompleteSchema.safeParse(completeBody({ ownerName: " A " })))
    ).toBe("Your name is too short");
    expect(
      messageOf(
        signupCompleteSchema.safeParse(completeBody({ ownerName: "a".repeat(101) }))
      )
    ).toBe("Your name must be at most 100 characters");
  });

  it("bounds the timezone to 100 characters after trimming", () => {
    expect(
      messageOf(signupCompleteSchema.safeParse(completeBody({ timeZone: "   " })))
    ).toBe("Time zone is required");
    expect(
      messageOf(
        signupCompleteSchema.safeParse(completeBody({ timeZone: "a".repeat(101) }))
      )
    ).toBe("Time zone must be at most 100 characters");
  });

  it("requires 12 characters of password", () => {
    expect(
      messageOf(signupCompleteSchema.safeParse(completeBody({ password: "eleven char" })))
    ).toBe("Password must be at least 12 characters long");
    expect(
      signupCompleteSchema.safeParse(completeBody({ password: "twelve chars" })).success
    ).toBe(true);
  });

  it("caps the password at the 72 UTF-8-byte boundary bcrypt uses", () => {
    const atLimit = "é".repeat(36); // 36 characters, 72 bytes
    const overLimit = "é".repeat(37); // 74 bytes
    expect(new TextEncoder().encode(atLimit)).toHaveLength(72);

    expect(
      signupCompleteSchema.safeParse(completeBody({ password: atLimit })).success
    ).toBe(true);
    expect(
      messageOf(signupCompleteSchema.safeParse(completeBody({ password: overLimit })))
    ).toBe("Password must be at most 72 bytes");

    expect(
      signupCompleteSchema.safeParse(completeBody({ password: "a".repeat(72) })).success
    ).toBe(true);
    expect(
      signupCompleteSchema.safeParse(completeBody({ password: "a".repeat(73) })).success
    ).toBe(false);
  });

  it("rejects client-supplied tenant identity and status", () => {
    for (const extra of [
      { email: "attacker@example.com" },
      { role: "OWNER" },
      { status: "ACTIVE" },
      { slug: "taken" },
      { restaurantId: "someone-else" },
    ]) {
      const result = signupCompleteSchema.safeParse(completeBody(extra));
      expect(result.success, JSON.stringify(extra)).toBe(false);
    }
  });

  it("accepts a named IANA zone and rejects a fixed offset", () => {
    expect(isValidTimeZone(signupCompleteSchema.parse(completeBody()).body.timeZone)).toBe(
      true
    );
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Asia/Dhaka")).toBe(true);
    expect(isValidTimeZone("+06:00")).toBe(false);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});
