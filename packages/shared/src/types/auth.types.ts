export const ROLES = ["OWNER", "MANAGER", "CHEF", "WAITER"] as const;
export type Role = (typeof ROLES)[number];

export const INVITABLE_ROLES = ["MANAGER", "CHEF", "WAITER"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const USER_STATUSES = ["INVITED", "ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

// What GET /auth/verify-invite discloses to whoever holds a live link: enough
// for the page to greet the invitee and name the role they were invited into,
// and nothing beyond the invitation itself. `role` is the wide Role rather than
// InvitableRole because it is read from the account, not from the request.
export interface InvitePreview {
  fullName: string;
  email: string;
  role: Role;
  expiresAt: string;
}

export const ROLE_LABELS: Record<InvitableRole, string> = {
  MANAGER: "Manager",
  CHEF: "Chef",
  WAITER: "Waiter",
};
export interface InvitedStaff {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
  inviteExpiresAt: string;
}
