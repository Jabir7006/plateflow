// Build-time switch, inlined by Next.js into both server and client bundles.
// It must stay in sync with the backend's SELF_SERVE_SIGNUP_ENABLED: the pages
// and the login link only appear when a build was made with the flag on, while
// the API independently refuses the routes when its own flag is off.
export const isSelfServeSignupEnabled =
  process.env.NEXT_PUBLIC_SELF_SERVE_SIGNUP_ENABLED === "true"
