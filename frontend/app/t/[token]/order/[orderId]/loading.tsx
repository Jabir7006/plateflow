// Shown during client-side navigation to the order page, before the status query
// resolves. Mirrors the page shell so there's no flash of a different surface.
export default function Loading() {
  return (
    <div className="menu-page min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-9 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  )
}
