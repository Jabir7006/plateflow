import { z } from "zod";
import { INVITABLE_ROLES } from "../types/auth.types.js";

const email = z
  .string("Valid email is required")
  .trim()
  .toLowerCase()
  .pipe(z.email("Valid email is required"));

const password = z
  .string("Password is required")
  .min(6, "Password must be at least 6 characters long");
const requiredString = (msg: string) => z.string(msg);

const inviteToken = requiredString("Invitation token is required")
  .trim()
  .min(1, "Invitation token is required");

export const inviteSchema = z.object({
  body: z.object({
    fullName: requiredString("Name is required")
      .trim()
      .min(2, "Name is too short"),
    email,
    role: z.enum(INVITABLE_ROLES, "Role is required"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email,
    password,
  }),
});

export const acceptInviteSchema = z.object({
  body: z.object({
    token: inviteToken,
    password,
  }),
});

export const verifyInviteSchema = z.object({
  query: z.object({
    token: inviteToken,
  }),
});

// Self-serve onboarding is email-first: no account or restaurant exists until
// the link holder submits the completed form. The same named schemas run in the
// browser form and on the API, so both reject identical shapes.

const signupEmail = z
  .string("Valid email is required")
  .trim()
  .toLowerCase()
  .max(254, "Email must be at most 254 characters")
  .pipe(z.email("Valid email is required"));

// randomId(32) is 32 random bytes in unpadded base64url: exactly 43 characters.
const signupToken = z
  .string("Signup link is invalid")
  .regex(/^[A-Za-z0-9_-]{43}$/, "Signup link is invalid");

const signupPassword = z
  .string("Password is required")
  .min(12, "Password must be at least 12 characters long")
  // bcrypt ignores everything past the first 72 bytes, so refuse the input
  // rather than silently keep a prefix of it.
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Password must be at most 72 bytes"
  );

const restaurantName = z
  .string("Restaurant name is required")
  .trim()
  .min(2, "Restaurant name is too short")
  .max(120, "Restaurant name must be at most 120 characters");

// The IANA zone itself is checked server-side by isValidTimeZone, which cannot
// live in the shared package (it needs Temporal). Bound the input here.
const reportingTimeZone = z
  .string("Time zone is required")
  .trim()
  .min(1, "Time zone is required")
  .max(100, "Time zone must be at most 100 characters");

const ownerName = z
  .string("Your name is required")
  .trim()
  .min(2, "Your name is too short")
  .max(100, "Your name must be at most 100 characters");

export const signupRequestSchema = z.object({
  body: z.strictObject({
    email: signupEmail,
  }),
});

export const signupVerifySchema = z.object({
  body: z.strictObject({
    token: signupToken,
  }),
});

export const signupCompleteSchema = z.object({
  body: z.strictObject({
    token: signupToken,
    restaurantName,
    timeZone: reportingTimeZone,
    ownerName,
    password: signupPassword,
  }),
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type InviteSchema = z.infer<typeof inviteSchema>;
export type AcceptInviteSchema = z.infer<typeof acceptInviteSchema>;
export type VerifyInviteSchema = z.infer<typeof verifyInviteSchema>;
export type SignupRequestSchema = z.infer<typeof signupRequestSchema>;
export type SignupVerifySchema = z.infer<typeof signupVerifySchema>;
export type SignupCompleteSchema = z.infer<typeof signupCompleteSchema>;
