"use client"

import { LogOut, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InviteStaffButton } from "@/features/staff/components/invite-staff-button"
import { getInvitableRolesFor } from "@/features/staff/permissions"
import { useLogout } from "../hooks/use-logout"
import { useAuthStore } from "../store/auth-store"

export function Dashboard() {
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()

  if (!user) return null

  const canInviteStaff = getInvitableRolesFor(user.role).length > 0

  return (
    <main className="min-h-svh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
              <UtensilsCrossed className="size-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">PlateFlow</span>
          </div>
          <div className="flex items-center gap-2">
            {canInviteStaff ? <InviteStaffButton /> : null}
            <Button
              variant="outline"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut />
              {logout.isPending ? "Logging out…" : "Log out"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Welcome, {user.fullName}</h1>
          <p className="mt-1 text-muted-foreground">
            Your PlateFlow workspace is ready.
          </p>
        </div>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your current staff session</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Email
                </dt>
                <dd className="mt-1">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Role
                </dt>
                <dd className="mt-1 capitalize">{user.role.toLowerCase()}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
