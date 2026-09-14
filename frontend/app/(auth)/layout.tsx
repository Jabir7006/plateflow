import { Suspense } from "react"
import { AuthProvider } from "@/features/auth/components/auth-provider"
import { GuestRoute } from "@/features/auth/components/guest-route"
import { SessionLoading } from "@/features/auth/components/session-loading"

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <Suspense fallback={<SessionLoading />}>
        <GuestRoute>{children}</GuestRoute>
      </Suspense>
    </AuthProvider>
  )
}
