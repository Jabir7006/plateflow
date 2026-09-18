"use client"

import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ROLE_LABELS, inviteSchema } from "@plateflow/shared"
import type { InvitableRole } from "@plateflow/shared"
import { SendHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError } from "@/lib/api-client"
import { getErrorMessage } from "@/lib/api-error"
import { extractFieldErrors } from "@/lib/api-field-errors"
import { useAuthStore } from "@/features/auth/store/auth-store"
import type { InviteInput } from "../api"
import { useInviteStaff } from "../hooks/use-invite-staff"
import { getInvitableRolesFor } from "../permissions"

const inviteFormSchema = inviteSchema.shape.body

// Chef is the only role every account able to open this dialog may grant, so
// it is the one default that stays valid for both OWNER and MANAGER.
const DEFAULT_VALUES: InviteInput = {
  fullName: "",
  email: "",
  role: "CHEF",
}

const fieldClassName =
  "h-10 border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"

const footerClassName = "flex-row gap-2 border-0 bg-transparent"

interface InviteStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteStaffDialog({
  open,
  onOpenChange,
}: InviteStaffDialogProps) {
  const user = useAuthStore((state) => state.user)
  const invite = useInviteStaff()
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<InviteInput>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  // Bound once by their owners (RHF and the TanStack observer), so both are
  // identity-stable across renders.
  const { mutate, reset: resetInviteState } = invite
  const isPending = invite.isPending

  const invitableRoles = user ? getInvitableRolesFor(user.role) : []

  // Every way out of the dialog funnels through here (X button, Escape,
  // backdrop click, Cancel): a pending request may not be orphaned by a
  // close, and a failed request never survives to greet the next open.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) return
    if (!nextOpen) resetInviteState()
    onOpenChange(nextOpen)
  }

  function onValidSubmit(values: InviteInput) {
    mutate(values, {
      // Start the next open from a clean form: these values already went out.
      onSuccess: () => {
        reset(DEFAULT_VALUES)
        handleOpenChange(false)
      },
      onError: (error) => {
        // A 401 means the session died while the dialog was open: hand the
        // store to ProtectedRoute so it routes to login with a return path,
        // instead of leaving the user retrying against a dead session.
        if (error instanceof ApiError && error.statusCode === 401) {
          useAuthStore.getState().setUnauthenticated()
          return
        }

        // Field-level server errors (schema drift, crafted requests) map onto
        // their inputs; anything else falls through to the banner below.
        for (const { field, message } of extractFieldErrors(error, [
          "fullName",
          "email",
          "role",
        ])) {
          setError(field as keyof InviteInput, { message })
        }
      },
    })
  }

  // Inline field errors win; the banner only speaks when nothing mapped.
  const hasMappedFieldErrors =
    extractFieldErrors(invite.error, ["fullName", "email", "role"]).length > 0

  const errorMessage =
    invite.isError && !hasMappedFieldErrors
      ? getErrorMessage(invite.error)
      : null

  // Nothing to offer this account; the upstream gate keeps this from rendering.
  if (!user || invitableRoles.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite staff</DialogTitle>
          <DialogDescription className="sr-only">
            Send an email invitation to a new team member.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit(onValidSubmit)}
        >
          <div className="space-y-2">
            <Label
              htmlFor="invite-full-name"
              className="text-sm font-normal text-foreground"
            >
              Full name
            </Label>
            <Input
              id="invite-full-name"
              placeholder="Karim Rahman"
              autoComplete="name"
              aria-invalid={Boolean(errors.fullName)}
              className={fieldClassName}
              {...register("fullName")}
            />
            {errors.fullName ? (
              <p className="text-sm text-destructive">
                {errors.fullName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="invite-email"
              className="text-sm font-normal text-foreground"
            >
              Email
            </Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              placeholder="name@gmail.com"
              aria-invalid={Boolean(errors.email)}
              className={fieldClassName}
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="invite-role"
              className="text-sm font-normal text-foreground"
            >
              Role
            </Label>
            <Controller
              control={control}
              name="role"
              render={({ field: { value, onChange } }) => (
                <Select
                  value={value}
                  disabled={isPending}
                  onValueChange={(next) => {
                    // Null never occurs with these fixed items; guard anyway.
                    if (next !== null) onChange(next)
                  }}
                >
                  <SelectTrigger
                    id="invite-role"
                    aria-invalid={Boolean(errors.role)}
                    className="h-10 w-full border-border bg-background text-foreground"
                  >
                    <SelectValue>
                      {(selected: InvitableRole | null) =>
                        selected ? ROLE_LABELS[selected] : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {invitableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.role ? (
              <p className="text-sm text-destructive">{errors.role.message}</p>
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

          <DialogFooter className={footerClassName}>
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-10 flex-1" disabled={isPending}>
              <SendHorizontal />
              {isPending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
