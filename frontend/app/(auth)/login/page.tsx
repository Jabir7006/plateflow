import LoginForm from "@/features/auth/components/login-form"
import { Mail, UtensilsCrossed } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            {/* Logo */}
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
            </div>

            {/* Heading */}
            <CardTitle className="text-2xl font-semibold">
              Log in to PlateFlow
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              Staff access only
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
            <div className="relative mt-4 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Invited but no account yet? Check your email for the setup
                  link.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
