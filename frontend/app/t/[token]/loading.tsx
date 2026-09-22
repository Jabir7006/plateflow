// Shown automatically while the server component in page.tsx awaits the menu
// fetch (cold load or after the 60s revalidate expires). It carries its own
// `.menu-page` wrapper so it renders in the diner's warm theme, and mirrors the
// real layout — top bar, category chips, a big immersive card — so the load
// reads as the menu arriving rather than a blank screen. Pure CSS pulse; no JS.
export default function Loading() {
  return (
    <div className="menu-page min-h-dvh bg-background text-foreground">
      <div className="flex h-dvh flex-col overflow-hidden">
        {/* Top bar: brand/table on the left, the two toggles on the right. */}
        <div className="shrink-0">
          <div className="flex items-center justify-between gap-3 px-4 pt-5 pb-2">
            <div className="space-y-2">
              <div className="h-2.5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="flex items-center gap-2">
              <div className="size-8 animate-pulse rounded-full bg-muted" />
              <div className="h-9 w-18 animate-pulse rounded-full bg-muted" />
            </div>
          </div>

          {/* Category chips. */}
          <div className="flex gap-2 px-4 py-2">
            {[64, 80, 56, 72].map((w, i) => (
              <div
                key={i}
                style={{ width: w }}
                className="h-8 animate-pulse rounded-full bg-muted"
              />
            ))}
          </div>
        </div>

        {/* Immersive card placeholder: a big square with the price/name/dots and
            the prev/add/next row beneath, matching the real deck. */}
        <div className="mx-auto flex w-full max-w-lg flex-col px-2 pt-2">
          <div className="py-4">
            <div className="mx-auto aspect-square w-[72%] animate-pulse rounded-[2rem] bg-muted" />
          </div>

          <div className="flex flex-col items-center gap-3 px-4 pt-5">
            <div className="h-7 w-40 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-52 animate-pulse rounded-full bg-muted" />
            <div className="mt-1 flex gap-1.5">
              {[20, 6, 6, 6].map((w, i) => (
                <div
                  key={i}
                  style={{ width: w }}
                  className="h-1.5 animate-pulse rounded-full bg-muted"
                />
              ))}
            </div>
            <div className="mt-5 flex w-full max-w-sm items-center gap-3">
              <div className="size-12 shrink-0 animate-pulse rounded-2xl bg-muted" />
              <div className="h-12 flex-1 animate-pulse rounded-2xl bg-muted" />
              <div className="size-12 shrink-0 animate-pulse rounded-2xl bg-muted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
