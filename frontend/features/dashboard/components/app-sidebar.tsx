"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { sidebarState } from "../sidebar-state"
import { NAV_ITEMS } from "../navigation"
import { SidebarUser } from "./sidebar-user"

// Desktop navigation rail. Hidden below md, where the MobileBottomBar takes
// over; both render the same NAV_ITEMS so they cannot drift apart.
// Collapsible down to an icon rail; the choice persists per browser.
export function AppSidebar() {
  const pathname = usePathname()
  const collapsed = useSyncExternalStore(
    sidebarState.subscribe,
    sidebarState.isCollapsed,
    sidebarState.getServerCollapsed
  )

  function renderNavItem(item: (typeof NAV_ITEMS)[number]) {
    const isActive = pathname === item.href
    const link = (
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-lg border text-sm font-medium transition-colors",
          collapsed ? "h-9 justify-center" : "px-3 py-2",
          isActive
            ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
            : "border-transparent text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="size-4 shrink-0" />
        {collapsed ? null : item.label}
      </Link>
    )

    // Icon-only rows need the label on hover; expanded rows show it inline.
    if (!collapsed) return link

    return (
      <Tooltip>
        <TooltipTrigger render={link} />
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        collapsed ? "w-14" : "w-52"
      )}
    >
      <div
        className={cn(
          "flex items-center py-4",
          collapsed ? "flex-col gap-2 px-2" : "justify-between px-4"
        )}
      >
        <BrandLogo className="size-9" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={sidebarState.toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <nav
        aria-label="Main"
        className={cn("flex-1 space-y-1 py-2", collapsed ? "px-2" : "px-3")}
      >
        {NAV_ITEMS.map(renderNavItem)}
      </nav>

      <div className={cn("pb-3", collapsed ? "px-2" : "px-3")}>
        <Separator className="bg-sidebar-border" />
        <div className="pt-3">
          <SidebarUser collapsed={collapsed} />
        </div>
      </div>
    </aside>
  )
}
