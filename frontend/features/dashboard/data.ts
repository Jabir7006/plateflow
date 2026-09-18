// Mock data for the dashboard while the kitchen features are being built.

export type LiveOrderStatus = "PENDING" | "PREPARING" | "READY"

export interface LiveOrder {
  id: string
  table: string
  itemCount: number
  status: LiveOrderStatus
}

export interface StaffOnShift {
  id: string
  name: string
  role: string
  avatarClassName: string
}

export interface DashboardStats {
  revenue: string
  activeOrders: string
  tablesOccupied: string
  outOfStock: string
}

export const dashboardStats: DashboardStats = {
  revenue: "₮18,420",
  activeOrders: "7",
  tablesOccupied: "9 / 14",
  outOfStock: "2 items",
}

export const liveOrders: LiveOrder[] = [
  { id: "order-1", table: "Table 4", itemCount: 2, status: "PENDING" },
  { id: "order-2", table: "Table 2", itemCount: 3, status: "PREPARING" },
  { id: "order-3", table: "Table 1", itemCount: 1, status: "READY" },
]

export const staffOnShift: StaffOnShift[] = [
  {
    id: "staff-1",
    name: "Abdul Hakim",
    role: "Chef",
    avatarClassName: "bg-amber-500/15 text-amber-400",
  },
  {
    id: "staff-2",
    name: "Rina Sultana",
    role: "Waiter",
    avatarClassName: "bg-muted text-foreground",
  },
]
