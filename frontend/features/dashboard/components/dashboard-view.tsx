"use client"

import { Ellipsis } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"
import { useAuthStore } from "@/features/auth/store/auth-store"
import { InviteStaffButton } from "@/features/staff/components/invite-staff-button"
import { getInvitableRolesFor } from "@/features/staff/permissions"
import { dashboardStats, liveOrders, staffOnShift } from "../data"
import { LiveOrdersCard } from "./live-orders-card"
import { PageHeader } from "./page-header"
import { StaffShiftCard } from "./staff-shift-card"
import { StatCard } from "./stat-card"

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

export function DashboardView() {
  const user = useAuthStore((state) => state.user)

  // This route is statically prerendered, so the date is formatted at render
  // time and suppressHydrationWarning lets the client value replace the
  // build-time one without a mismatch warning.
  const today = DATE_FORMAT.format(new Date())

  const canInviteStaff = user
    ? getInvitableRolesFor(user.role).length > 0
    : false

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={today}
        actions={
          <>
            {canInviteStaff ? <InviteStaffButton /> : null}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Dashboard options"
                  >
                    <Ellipsis />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    toast.add({
                      type: "info",
                      title: "Mock data",
                      description:
                        "Live order and menu data is not wired up yet.",
                    })
                  }
                >
                  Refresh data
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <section
        aria-label="Key metrics"
        className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard label="Today's revenue" value={dashboardStats.revenue} />
        <StatCard label="Active orders" value={dashboardStats.activeOrders} />
        <StatCard
          label="Tables occupied"
          value={dashboardStats.tablesOccupied}
        />
        <StatCard
          label="Out of stock"
          value={dashboardStats.outOfStock}
          valueClassName="text-destructive"
        />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <LiveOrdersCard orders={liveOrders} />
        <StaffShiftCard staff={staffOnShift} />
      </section>
    </>
  )
}
