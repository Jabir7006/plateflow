"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signupCompleteSchema } from "@plateflow/shared"
import type { OwnerSignupPreview } from "@plateflow/shared"
import { z } from "zod"
import { Link2Off, Loader2, Store } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api-client"
import { getErrorMessage } from "@/lib/api-error"
import { extractFieldErrors } from "@/lib/api-field-errors"
import { completeSignup, verifySignup } from "../api"
import { useSetSession } from "../hooks/use-set-session"
import { canRetrySignupVerification } from "../signup-retry"
import { readSignupToken } from "../signup-token"

// Mirrors the API body one-for-one, plus a form-only confirmation field so a
// mistyped password cannot lock the owner out of the account they just made.
const completeFormSchema = z
  .object({
    restaurantName: signupCompleteSchema.shape.body.shape.restaurantName,
    ownerName: signupCompleteSchema.shape.body.shape.ownerName,
    timeZone: signupCompleteSchema.shape.body.shape.timeZone,
    password: signupCompleteSchema.shape.body.shape.password,
    confirmPassword: z.string("Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type CompleteFormValues = z.infer<typeof completeFormSchema>

const fieldClassName =
  "h-11 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"

// Intl's zone list is the browser's own IANA database, so the suggestions match
// what the backend validator accepts. UTC is omitted from supportedValuesOf but
// is a valid choice and the safest default.
const TIME_ZONES: string[] = (() => {
  try {
    const supported = (
      Intl as typeof Intl & {
        supportedValuesOf?: (key: "timeZone") => string[]
      }
    ).supportedValuesOf?.("timeZone")

    if (!supported?.length) return ["UTC"]
    return supported.includes("UTC") ? supported : ["UTC", ...supported]
  } catch {
    return ["UTC"]
  }
})()

type Phase = "capturing" | "verifying" | "ready" | "broken"

function CenteredNote({ label }: { label: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {label}
      </div>
    </main>
  )
}

function BrokenSignupState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-destructive/15 ring-1 ring-destructive/30 ring-inset">
          <Link2Off className="size-5 text-destructive" aria-hidden="true" />
        </div>

        <h1 className="mt-4 text-xl font-semibold">
          This signup link is not working
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>

        <div className="mt-5 flex gap-2">
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              onClick={onRetry}
            >
              Try again
            </Button>
          ) : null}
          <Link
            href="/signup"
            className={cn(buttonVariants(), "h-10 flex-1")}
          >
            Request a new link
          </Link>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Or{" "}
          <Link
            href="/login"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            log in
          </Link>{" "}
          if your account is already set up.
        </p>
      </div>
    </main>
  )
}

export function SignupCompleteForm() {
  const router = useRouter()
  const setSession = useSetSession()

  const [phase, setPhase] = useState<Phase>("capturing")
  const [token, setToken] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [preview, setPreview] = useState<OwnerSignupPreview | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [canRetry, setCanRetry] = useState(false)
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const captured = useRef(false)
  const submitInFlight = useRef(false)
  const completed = useRef(false)
  const deferredHash = useRef<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<CompleteFormValues>({
    resolver: zodResolver(completeFormSchema),
    defaultValues: {
      restaurantName: "",
      ownerName: "",
      timeZone: "UTC",
      password: "",
      confirmPassword: "",
    },
  })

  // Switch the whole page to a captured link. The form reset is deliberate:
  // a replacement email must never be submitted with the previous link's
  // restaurant, owner, or password still in React Hook Form.
  const applyToken = useCallback(
    (rawHash: string) => {
      const parsedToken = readSignupToken(rawHash)

      reset()
      setPreview(null)
      setCanRetry(false)
      setLinkError(null)
      setSubmitError(null)

      if (!parsedToken) {
        // No usable token: do not leave the old token armed for a submit.
        setToken("")
        setPhase("broken")
        return
      }

      setToken(parsedToken)
      // Increment even when the fragment repeats the current token, so a
      // deliberate re-open always starts a fresh verification.
      setAttempt((value) => value + 1)
      setPhase("verifying")
    },
    [reset]
  )

  // The fragment never reaches the server. Capture it, remove it from the
  // address bar immediately, and keep it only in component state. A later
  // fragment change (for example, opening a fresh link while this page is
  // already showing an expired-link error) does not remount the page, so the
  // hashchange listener repeats the same capture and verification in place.
  // While a completion is in flight, hold the replacement until its result is
  // known: a late 400 from the old link must not overwrite the new link's flow.
  // The fragment is only readable after hydration, so this effect is the
  // necessary boundary between the browser URL and React state. The ref guard
  // keeps Strict Mode's replay from consuming the initial fragment twice.
  useEffect(() => {
    function capture(rawHash: string) {
      if (rawHash) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        )
      }

      // A successful completion owns the tab until the dashboard mounts.
      if (completed.current) return

      if (submitInFlight.current) {
        deferredHash.current = rawHash
        return
      }

      applyToken(rawHash)
    }

    if (!captured.current) {
      captured.current = true
      capture(window.location.hash)
    }

    function onHashChange() {
      const hash = window.location.hash
      // replaceState above does not emit hashchange; an empty hash means the
      // token was already consumed.
      if (hash) capture(hash)
    }

    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [applyToken])

  useEffect(() => {
    if (!token) return

    let cancelled = false

    verifySignup(token).then(
      (result) => {
        if (cancelled) return
        setPreview(result)
        setPhase("ready")
      },
      (error: unknown) => {
        if (cancelled) return
        // A rejected link is settled; a network or server failure may pass.
        setCanRetry(canRetrySignupVerification(error))
        setLinkError(getErrorMessage(error))
        setPhase("broken")
      }
    )

    return () => {
      cancelled = true
    }
  }, [token, attempt])

  // Retry in place with the token already held in memory. Reloading would lose
  // the fragment (it was removed from the address bar) and show "missing token".
  function retryVerification() {
    setCanRetry(false)
    setLinkError(null)
    setPhase("verifying")
    setAttempt((value) => value + 1)
  }

  // Preselect the browser's zone after hydration: computing it during render
  // would disagree with the server and trip a hydration mismatch.
  useEffect(() => {
    if (phase !== "ready") return

    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (zone) setValue("timeZone", zone)
  }, [phase, setValue])

  async function onValidSubmit(values: CompleteFormValues) {
    if (submitInFlight.current || !token) return

    submitInFlight.current = true
    setPending(true)
    setSubmitError(null)

    let succeeded = false

    try {
      const user = await completeSignup({
        token,
        restaurantName: values.restaurantName,
        ownerName: values.ownerName,
        timeZone: values.timeZone,
        password: values.password,
      })

      // Clear any cached data from a previous tenant in this tab before the new
      // session is adopted.
      setSession(user)
      // Mark success before navigation so a hashchange racing the unmount
      // cannot replace the completed signup with another link's flow.
      completed.current = true
      router.replace("/dashboard")
      router.refresh()
      succeeded = true
    } catch (error) {
      const fieldErrors = extractFieldErrors(error, [
        "restaurantName",
        "ownerName",
        "timeZone",
        "password",
      ])

      for (const { field, message } of fieldErrors) {
        setError(field as keyof CompleteFormValues, { message })
      }

      if (fieldErrors.length > 0) {
        setSubmitError(null)
      } else if (error instanceof ApiError && error.statusCode === 400) {
        // The link expired or was spent between the preview and submit; the
        // correction is a new link, not a form retry.
        setLinkError(getErrorMessage(error))
        setPhase("broken")
      } else {
        setSubmitError(getErrorMessage(error))
      }

      // Clear the password inputs even though react-hook-form keeps values by
      // default: the credential should not linger in the DOM after a failure.
      setValue("password", "")
      setValue("confirmPassword", "")
    } finally {
      submitInFlight.current = false
      setPending(false)

      const deferred = deferredHash.current
      deferredHash.current = null

      // A successful completion navigates away; the replacement link is spent
      // with this page. On failure, hand control to the newest link only now.
      if (!succeeded && deferred !== null) {
        applyToken(deferred)
      }
    }
  }

  if (phase === "capturing") {
    return <CenteredNote label="Checking your link…" />
  }

  if (phase === "verifying") {
    return <CenteredNote label="Verifying your link…" />
  }

  if (phase === "broken") {
    return (
      <BrokenSignupState
        message={
          linkError ??
          "This link is missing its token. Open the link from your signup email again, or request a new one."
        }
        onRetry={canRetry ? retryVerification : undefined}
      />
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <BrandLogo />

        <div className="mt-6 flex size-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30 ring-inset">
          <Store className="size-5 text-primary" aria-hidden="true" />
        </div>

        <h1 className="mt-4 text-2xl font-semibold">Set up your restaurant</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This email is verified. Add your restaurant details and owner account.
        </p>

        <dl className="mt-5 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <dt className="shrink-0 text-sm text-muted-foreground">Email</dt>
            <dd className="min-w-0 truncate text-sm font-medium">
              {preview?.email}
            </dd>
          </div>
        </dl>

        <form
          className="mt-5 space-y-4"
          noValidate
          onSubmit={handleSubmit(
            // This is the form's submit event, not render. Its refs guard the
            // in-flight request and hold a replacement link until it settles.
            // eslint-disable-next-line react-hooks/refs
            onValidSubmit
          )}
        >
          <div className="space-y-2">
            <Label
              htmlFor="restaurant-name"
              className="text-sm font-normal text-foreground"
            >
              Restaurant name
            </Label>
            <Input
              id="restaurant-name"
              placeholder="Spice Garden"
              autoComplete="organization"
              aria-invalid={Boolean(errors.restaurantName)}
              className={fieldClassName}
              {...register("restaurantName")}
            />
            {errors.restaurantName ? (
              <p className="text-sm text-destructive">
                {errors.restaurantName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="owner-name"
              className="text-sm font-normal text-foreground"
            >
              Your name
            </Label>
            <Input
              id="owner-name"
              placeholder="Asha Rahman"
              autoComplete="name"
              aria-invalid={Boolean(errors.ownerName)}
              className={fieldClassName}
              {...register("ownerName")}
            />
            {errors.ownerName ? (
              <p className="text-sm text-destructive">
                {errors.ownerName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="time-zone"
              className="text-sm font-normal text-foreground"
            >
              Time zone
            </Label>
            <Input
              id="time-zone"
              list="signup-time-zones"
              placeholder="Asia/Dhaka"
              autoComplete="off"
              aria-invalid={Boolean(errors.timeZone)}
              aria-describedby="time-zone-help"
              className={fieldClassName}
              {...register("timeZone")}
            />
            <datalist id="signup-time-zones">
              {TIME_ZONES.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
            <p
              id="time-zone-help"
              className="text-xs text-muted-foreground"
            >
              Used for daily sales reports. Pick the restaurant&apos;s local
              zone. UTC is always available.
            </p>
            {errors.timeZone ? (
              <p className="text-sm text-destructive">
                {errors.timeZone.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="owner-password"
              className="text-sm font-normal text-foreground"
            >
              Password
            </Label>
            <Input
              id="owner-password"
              type="password"
              placeholder="At least 12 characters"
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

          {submitError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {submitError}
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
                Creating your restaurant…
              </>
            ) : (
              "Create restaurant"
            )}
          </Button>
        </form>
      </div>
    </main>
  )
}
