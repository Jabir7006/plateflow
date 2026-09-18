import LoginForm from "@/features/auth/components/login-form"
import { BrandLogo } from "@/components/brand-logo"
import { Mail } from "lucide-react"

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <BrandLogo />

        <h1 className="mt-6 text-2xl font-semibold">Log in to PlateFlow</h1>
        <p className="mt-1 text-sm text-muted-foreground">Staff access only</p>

        {/* LoginForm reads useSearchParams; the (auth) layout's Suspense
            boundary covers it, and the GuestRoute gate renders its own
            loading state before this ever mounts. */}
        <LoginForm />

        <div className="mt-4 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Invited but no account yet? Check your email for the setup link.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
