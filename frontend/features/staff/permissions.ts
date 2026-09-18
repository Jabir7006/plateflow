import { INVITABLE_ROLES } from "@plateflow/shared"
import type { InvitableRole, Role } from "@plateflow/shared"

// Mirrors the backend policy (staff.service.assertMayManage): the owner may
// grant any staff role, a manager only chef and waiter, and chef and waiter
// nothing at all. The backend stays the enforcement authority; this only
// decides what the UI offers and shows.
export function getInvitableRolesFor(actorRole: Role): InvitableRole[] {
  switch (actorRole) {
    case "OWNER":
      return [...INVITABLE_ROLES]
    case "MANAGER":
      return INVITABLE_ROLES.filter((role) => role !== "MANAGER")
    default:
      // CHEF and WAITER (and any role added later) may not invite.
      return []
  }
}
