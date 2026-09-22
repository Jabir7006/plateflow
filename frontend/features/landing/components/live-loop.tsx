import { FLOW_STEPS } from "../content"
import { Reveal } from "./reveal"

export function LiveLoop() {
  return (
    <section id="flow" className="border-t border-border/60 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            One loop, from order to pickup
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-pretty">
            No paper tickets, no shouting across the pass. Every step is
            connected, so the diner and the kitchen always see the same thing.
          </p>
        </div>

        <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW_STEPS.map((step, i) => (
            <Reveal key={step.step} as="li" delay={i * 100}>
              <span className="font-display text-sm font-semibold text-brand">
                {step.step}
              </span>
              <div className="mt-3 h-px w-full bg-border">
                <span className="block h-px w-8 bg-brand" />
              </div>
              <h3 className="mt-4 font-medium text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground text-pretty">
                {step.body}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
