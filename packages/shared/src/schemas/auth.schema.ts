import { z } from "zod";

const email = z.email("Valid email is required");
const password = z
  .string("Password is required")
  .min(6, "Password must be at least 6 characters long");
const requiredString = (msg: string) => z.string(msg);

export const inviteSchema = z.object({
  fullName: requiredString("Name is required"),
  email,
  role: z.enum(["MANAGER", "CHEF", "WAITER"], "Role is required"),
});

export const loginSchema = z.object({
  body: z.object({
    email,
    password,
  }),
});

export const acceptInviteSchema = z.object({
  token: requiredString("Token is required"),
  password,
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type InviteSchema = z.infer<typeof inviteSchema>;
export type AcceptInviteSchema = z.infer<typeof acceptInviteSchema>;
