import type { InviteSchema, InvitedStaff } from "@plateflow/shared"
import { apiRequest } from "@/lib/api-client"

export type InviteInput = InviteSchema["body"]
export type { InvitedStaff }

export function inviteStaff(input: InviteInput): Promise<InvitedStaff> {
  return apiRequest<InvitedStaff>("/staff/invite", {
    method: "POST",
    body: input,
  })
}
