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
import { AppSidebar } from "./app-sidebar"
import { LiveOrdersCard } from "./live-orders-card"
import { MobileBottomBar } from "./mobile-bottombar"
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
    <div className="flex min-h-svh bg-background">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Dashboard</h1>
              <p
                suppressHydrationWarning
                className="mt-0.5 min-h-5 text-sm text-muted-foreground"
              >
                {today}
              </p>
            </div>

            <div className="flex items-center gap-2">
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
            </div>
          </header>

          <section
            aria-label="Key metrics"
            className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <StatCard label="Today's revenue" value={dashboardStats.revenue} />
            <StatCard
              label="Active orders"
              value={dashboardStats.activeOrders}
            />
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
        </main>

        <MobileBottomBar />
      </div>
    </div>
  )
}
