import { z } from "zod";

export const registerSchema = z.object({
  name: z.string("Name is required"),
  email: z.email("Valid Email is required"),
  password: z
    .string("Password is required")
    .min(6, "Password must be at least 6 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
