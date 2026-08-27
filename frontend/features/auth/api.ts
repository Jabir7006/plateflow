import type { AuthUser, LoginSchema } from "@plateflow/shared"
import { apiRequest } from "@/lib/api-client"

export type LoginInput = LoginSchema["body"]

export async function loginUser(input: LoginInput): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/login", {
    method: "POST",
    body: input,
  })
}
