import type { LucideIcon } from "lucide-react"
import {
  ClipboardList,
  LayoutGrid,
  Table2,
  Users,
  UtensilsCrossed,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

// Single source for the desktop sidebar and the mobile bottom bar so the two

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Menu", href: "/menu", icon: UtensilsCrossed },
  { label: "Orders", href: "/orders", icon: ClipboardList },
  { label: "Staff", href: "/staff", icon: Users },
  { label: "Tables", href: "/tables", icon: Table2 },
]
