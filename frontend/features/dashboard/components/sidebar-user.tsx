"use client"

import { LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getInitials } from "@/lib/initials"
import { useLogout } from "@/features/auth/hooks/use-logout"
import { useAuthStore } from "@/features/auth/store/auth-store"

interface SidebarUserProps {
  collapsed?: boolean
}

// Sidebar footer: the signed-in staff member. The whole row opens a menu so
// logging out stays reachable without a dedicated header button. In the
// collapsed rail only the avatar remains, labeled by a tooltip.
export function SidebarUser({ collapsed = false }: SidebarUserProps) {
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()

  if (!user) return null

  const trigger = (
    <DropdownMenuTrigger
      render={
        <button
          type="button"
          className={cn(
            "flex w-full items-center rounded-lg p-2 text-left outline-none hover:bg-sidebar-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50",
            collapsed && "justify-center"
          )}
        >
          <Avatar>
            <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
          </Avatar>
          {collapsed ? null : (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {user.fullName}
              </span>
              <span className="block truncate text-xs text-muted-foreground capitalize">
                {user.role.toLowerCase()}
              </span>
            </span>
          )}
        </button>
      }
    />
  )

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger render={trigger} />
          <TooltipContent side="right">
            {user.fullName} · {user.role.toLowerCase()}
          </TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent side="top" align="start" className="w-48">
        <DropdownMenuItem variant="destructive" onClick={() => logout.mutate()}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
