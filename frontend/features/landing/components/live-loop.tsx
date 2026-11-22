import { FLOW_STEPS } from "../content"

export function LiveLoop() {
  return (
    <section id="flow" className="landing-section" aria-labelledby="flow-title">
      <div className="landing-container">
        <div className="landing-section-heading">
          <div>
            <p className="landing-label">How it works</p>
            <h2 id="flow-title" className="landing-heading">
              One table
              <br />
              One connected service
            </h2>
          </div>
          <p className="landing-copy">
            From the first scan to the final pickup, a simpler path between your
            guests and your kitchen.
          </p>
        </div>
        <ol className="landing-flow-grid">
          {FLOW_STEPS.map((step) => (
            <li key={step.step} className="landing-flow-step">
              <span className="landing-flow-number">{step.step}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="landing-roadmap-note">
          One connected view for your guests, your kitchen and your floor
        </p>
      </div>
    </section>
  )
}
