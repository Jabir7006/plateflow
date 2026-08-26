"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

const LoginForm = () => {
  return (
    <form className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-normal text-foreground">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="name@restaurant.com"
          required
          autoComplete="email"
          className="h-11 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="password"
            className="text-sm font-normal text-foreground"
          >
            Password
          </Label>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          required
          autoComplete="current-password"
          className="h-11 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <Button
        type="submit"
        className="h-11 w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
      >
        Log in
      </Button>
    </form>
  )
}

export default LoginForm
