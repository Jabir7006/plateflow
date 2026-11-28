"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signupRequestSchema } from "@plateflow/shared"
import { Loader2, MailCheck, Store } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getErrorMessage } from "@/lib/api-error"
import { requestSignup, type SignupRequestInput } from "../api"

const emailSchema = signupRequestSchema.shape.body

const fieldClassName =
  "h-11 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"

export function SignupRequestForm() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SignupRequestInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  })

  async function onValidSubmit(values: SignupRequestInput) {
    if (pending) return

    setPending(true)
    setError(null)

    try {
      await requestSignup(values)
      // Show the address back so a typo is obvious, but keep the copy generic:
      // the API answers the same whether or not an account already exists.
      setSentTo(values.email)
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setPending(false)
    }
  }

  if (sentTo) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <BrandLogo />

          <div className="mt-6 flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30 ring-inset">
            <MailCheck className="size-5 text-emerald-400" aria-hidden="true" />
          </div>

          <h1 className="mt-4 text-2xl font-semibold">Check your inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground" role="status">
            If <span className="font-medium text-foreground">{sentTo}</span>{" "}
            can sign up, a link is on its way. It expires in 30 minutes.
          </p>

          <div className="mt-6 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full border-border bg-background"
              onClick={() => {
                setSentTo(null)
                setError(null)
                reset()
              }}
            >
              Use a different email
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already set up?{" "}
              <Link
                href="/login"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <BrandLogo />

        <div className="mt-6 flex size-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30 ring-inset">
          <Store className="size-5 text-primary" aria-hidden="true" />
        </div>

        <h1 className="mt-4 text-2xl font-semibold">Open your restaurant</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with your email. We&apos;ll send a link to verify it, then
          you&apos;ll set up your restaurant and owner account.
        </p>

        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={handleSubmit(onValidSubmit)}
        >
          <div className="space-y-2">
            <Label
              htmlFor="signup-email"
              className="text-sm font-normal text-foreground"
            >
              Work email
            </Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="owner@restaurant.com"
              autoComplete="email"
              autoFocus
              aria-invalid={Boolean(errors.email)}
              className={fieldClassName}
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={pending}
            className="h-11 w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Sending link…
              </>
            ) : (
              "Send signup link"
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              Log in
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}
