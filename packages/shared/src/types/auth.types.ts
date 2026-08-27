export const ROLES = ["MANAGER", "CHEF", "WAITER"] as const;
export type Role = (typeof ROLES)[number];

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
