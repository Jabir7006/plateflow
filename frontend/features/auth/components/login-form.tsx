"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema } from "@plateflow/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getErrorMessage } from "@/lib/api-error"
import { useLogin, type LoginInput } from "../hooks/use-login"

const credentialsSchema = loginSchema.shape.body

const AFTER_LOGIN_ROUTE = "/"

const LoginForm = () => {
  const router = useRouter()
  const login = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  })

  const errorMessage = getErrorMessage(login.error)

  function onValidSubmit(data: LoginInput) {
    login.mutate(data, {
      onSuccess: () => router.push(AFTER_LOGIN_ROUTE),
    })
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit(onValidSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-normal text-foreground">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="name@restaurant.com"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          className="h-11 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        ) : null}
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
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          className="h-11 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        ) : null}
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={login.isPending}
        className="h-11 w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {login.isPending ? "Signing in…" : "Log in"}
      </Button>
    </form>
  )
}

export default LoginForm
