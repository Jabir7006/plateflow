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

export type LoginSchema = z.infer<typeof loginSchema>;
export type InviteSchema = z.infer<typeof inviteSchema>;
export type AcceptInviteSchema = z.infer<typeof acceptInviteSchema>;
export type VerifyInviteSchema = z.infer<typeof verifyInviteSchema>;
