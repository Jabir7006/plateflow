import { INVITABLE_ROLES } from "@plateflow/shared"
import type { InvitableRole, Role } from "@plateflow/shared"

export function getInvitableRolesFor(actorRole: Role): InvitableRole[] {
  return actorRole === "OWNER"
    ? [...INVITABLE_ROLES]
    : INVITABLE_ROLES.filter((role) => role !== "MANAGER")
}
