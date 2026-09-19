import { AppSidebar } from "./app-sidebar"
import { MobileBottomBar } from "./mobile-bottombar"

// The chrome shared by every dashboard page: the desktop rail, the mobile
// bottom bar, and the centered content column. Pages render only their own
// content, so the navigation lives in one place and the pages cannot drift
// apart. Rendered once in the protected layout, so it persists across
// navigations instead of remounting per page.
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10">
          {children}
        </main>

        <MobileBottomBar />
      </div>
    </div>
  )
}
