import { FEATURES } from "../content"

export function FeatureGrid() {
  return (
    <section
      id="features"
      className="landing-section landing-features"
      aria-labelledby="features-title"
    >
      <div className="landing-container">
        <div className="landing-section-heading">
          <div>
            <p className="landing-label">The everyday essentials</p>
            <h2 id="features-title" className="landing-heading">
              Thought through
              <br />
              From menu to service
            </h2>
          </div>
          <p className="landing-copy">
            The small details make a restaurant run well. Keep your menu, tables
            and people organised in one place.
          </p>
        </div>
        <div className="landing-feature-grid">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <article key={feature.title} className="landing-feature">
                <div className="landing-feature-top">
                  <Icon aria-hidden="true" />
                  {feature.status === "building" ? (
                    <span className="landing-feature-status">
                      In development
                    </span>
                  ) : null}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
