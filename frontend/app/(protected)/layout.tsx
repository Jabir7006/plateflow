import { Suspense } from "react"
import { AuthProvider } from "@/features/auth/components/auth-provider"
import { ProtectedRoute } from "@/features/auth/components/protected-route"
import { SessionLoading } from "@/features/auth/components/session-loading"

export default function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <Suspense fallback={<SessionLoading />}>
        <ProtectedRoute>{children}</ProtectedRoute>
      </Suspense>
    </AuthProvider>
  )
}
