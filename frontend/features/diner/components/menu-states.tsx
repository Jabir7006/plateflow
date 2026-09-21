import { UtensilsCrossed } from "lucide-react"

// Shared centered layout for the two "nothing to show" outcomes, so they read
// as deliberate pages rather than errors.
function StateShell({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UtensilsCrossed className="size-6" />
      </div>
      <h1 className="font-display text-2xl font-semibold text-foreground">
        {title}
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {message}
      </p>
    </div>
  )
}

// The scanned code resolved to no table (garbage, or a sticker whose code was
// regenerated). Points the diner at the one action that always works: ask staff.
export function InvalidToken() {
  return (
    <StateShell
      title="This code isn't valid"
      message="The QR code you scanned is out of date or unrecognised. Ask a member of staff for an up-to-date one."
    />
  )
}

// A real table, but the menu has no available items right now.
export function EmptyMenu() {
  return (
    <StateShell
      title="Menu's being updated"
      message="There's nothing to show just yet. Please check back in a moment or ask a member of staff."
    />
  )
}
