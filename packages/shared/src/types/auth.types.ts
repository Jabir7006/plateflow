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
