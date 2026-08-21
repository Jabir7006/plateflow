import { z } from "zod";

const email = z.email("Valid email is required");
const password = z.string("Password is required").min(6, "...");
const requiredString = (msg: string) => z.string(msg);

// 2. Build schemas with the primitives
export const inviteSchema = z.object({
  fullName: requiredString("Name is required"),
  email,
});

export const loginSchema = z.object({
  email,
  password,
});

export const acceptInviteSchema = z.object({
  token: requiredString("Token is required"),
  password,
});
