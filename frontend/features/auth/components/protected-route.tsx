"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { initializeAuth } from "./auth-provider"
import { SessionLoading } from "./session-loading"
import { useAuthStore } from "../store/auth-store"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const status = useAuthStore((state) => state.status)
  const error = useAuthStore((state) => state.error)

  useEffect(() => {
    if (status !== "unauthenticated") return

    const query = searchParams.toString()
    const returnPath = `${pathname}${query ? `?${query}` : ""}`
    router.replace(`/login?next=${encodeURIComponent(returnPath)}`)
  }, [pathname, router, searchParams, status])

  if (status === "error") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="max-w-sm space-y-4 text-center">
          <div>
            <h1 className="font-medium">
              We couldn&apos;t verify your session
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {error ?? "Check your connection and try again."}
            </p>
          </div>
          <Button onClick={() => void initializeAuth()}>Try again</Button>
        </div>
      </main>
    )
  }

  if (status !== "authenticated") return <SessionLoading />

  return children
}
