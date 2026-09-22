import { FEATURES } from "../content"
import { Reveal } from "./reveal"

export function FeatureGrid() {
  return (
    <section id="features" className="border-t border-border/60 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a table needs, in one place
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-pretty">
            The menu, the orders and the people who run the floor — managed
            together, not bolted on.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon
            return (
              <Reveal
                key={feature.title}
                delay={Math.min(i * 60, 300)}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand/12 text-brand">
                    <Icon className="size-5" />
                  </span>
                  {feature.status === "building" ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      In progress
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-4 font-medium text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground text-pretty">
                  {feature.body}
                </p>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
