"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { acceptInviteSchema } from "@plateflow/shared"
import type { InvitePreview } from "@plateflow/shared"
import { z } from "zod"
import { Clock, Link2Off, Loader2, UserRoundCheck } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api-client"
import { getErrorMessage } from "@/lib/api-error"
import { extractFieldErrors } from "@/lib/api-field-errors"
import { formatDurationUntil } from "@/lib/format-duration"
import { useAcceptInvite } from "../hooks/use-accept-invite"
import { useVerifyInvite } from "../hooks/use-verify-invite"

// The shared schema covers what the API accepts; the confirmation field is a
// form-only guard against typos, checked here instead of on the server.
const acceptInviteFormSchema = z
  .object({
    password: acceptInviteSchema.shape.body.shape.password,
    confirmPassword: z.string("Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type AcceptInviteFormValues = z.infer<typeof acceptInviteFormSchema>

const fieldClassName =
  "h-11 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"

const MINUTE_MS = 60 * 1000

// Phrasing for the footer clock. Recomputed on a one-minute tick so a page
// left open stays truthful as the invite approaches its deadline; a static
// label would quietly go stale across a day boundary.
function useExpiryLabel(expiresAt: string): string {
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), MINUTE_MS)
    return () => clearInterval(timer)
  }, [])

  return formatDurationUntil(expiresAt)
}

// A dead link gets its own screen: the backend message (expired, already
// accepted, disabled) is the explanation, and a retry is offered only when
// the failure could actually be transient.
function BrokenInviteState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  const message =
    getErrorMessage(error) ?? "Ask your manager to send a new invitation."

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-destructive/15 ring-1 ring-destructive/30 ring-inset">
          <Link2Off className="size-5 text-destructive" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">
            This invite link is not working
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex gap-2">
          {error && !(error instanceof ApiError) ? (
            <Button variant="outline" className="h-10 flex-1" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          <Link href="/login" className={cn(buttonVariants(), "h-10 flex-1")}>
            Go to login
          </Link>
        </div>
      </div>
    </main>
  )
}

function VerifyingInviteState() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Verifying your invitation…
      </div>
    </main>
  )
}

function InviteDetailsCard({ preview }: { preview: InvitePreview }) {
  return (
    <dl className="mt-6 space-y-2.5 rounded-lg border border-border bg-muted/50 px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">Name</dt>
        <dd className="min-w-0 truncate text-sm font-medium">
          {preview.fullName}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">Email</dt>
        <dd className="min-w-0 truncate text-sm font-medium">
          {preview.email}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="shrink-0 text-sm text-muted-foreground">Role</dt>
        <dd className="shrink-0">
          <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-400 capitalize ring-1 ring-blue-500/30 ring-inset">
            {preview.role.toLowerCase()}
          </span>
        </dd>
      </div>
    </dl>
  )
}

function ExpiryNote({ expiresAt }: { expiresAt: string }) {
  const remaining = useExpiryLabel(expiresAt)

  return (
    <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
      This invite link expires {remaining}.
    </p>
  )
}

interface AcceptInviteFormProps {
  token: string
}

export function AcceptInviteForm({ token }: AcceptInviteFormProps) {
  const router = useRouter()
  const invite = useVerifyInvite(token)
  const accept = useAcceptInvite()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  const isSubmitting = accept.isPending

  // A missing or malformed token goes straight to the broken-link state;
  // there is nothing worth asking the server about.
  if (token === "" || invite.isError) {
    return (
      <BrokenInviteState
        error={invite.error}
        onRetry={() => void invite.refetch()}
      />
    )
  }

  if (invite.isPending || !invite.data) {
    return <VerifyingInviteState />
  }

  function onValidSubmit(values: AcceptInviteFormValues) {
    accept.mutate(
      { token, password: values.password },
      {
        // The backend has already issued this browser the session cookies, so
        // a refresh gives the server components the new session too.
        onSuccess: () => {
          router.replace("/dashboard")
          router.refresh()
        },
        onError: (error) => {
          // Field-level server errors map onto their inputs; anything else
          // falls through to the banner below.
          for (const { field, message } of extractFieldErrors(error, [
            "password",
          ])) {
            setError(field as "password", { message })
          }
        },
      }
    )
  }

  const errorMessage = getErrorMessage(accept.error)

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30 ring-inset">
          <UserRoundCheck
            className="size-5 text-emerald-400"
            aria-hidden="true"
          />
        </div>

        <h1 className="mt-6 text-2xl font-semibold">Welcome to PlateFlow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set a password to activate your account.
        </p>

        <InviteDetailsCard preview={invite.data} />

        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={handleSubmit(onValidSubmit)}
        >
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-normal text-foreground"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              className={fieldClassName}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirm-password"
              className="text-sm font-normal text-foreground"
            >
              Confirm password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Re-enter your password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              className={fieldClassName}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            ) : null}
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
            disabled={isSubmitting}
            className="h-11 w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Activating…" : "Activate account"}
          </Button>
        </form>

        <ExpiryNote expiresAt={invite.data.expiresAt} />
      </div>
    </main>
  )
}
