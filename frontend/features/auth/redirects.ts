const DEFAULT_AUTHENTICATED_ROUTE = "/dashboard"

export function getSafeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTHENTICATED_ROUTE
  }

  try {
    const url = new URL(value, "http://plateflow.local")
    // Trailing slashes normalised so /login/ can't slip past the loop guard.
    const path = url.pathname.replace(/\/+$/, "") || "/"

    // Guest-only screens must never become the post-login destination, or a
    // successful signup would bounce straight back to the signup form.
    const isGuestPath =
      path === "/login" || path === "/signup" || path.startsWith("/signup/")

    if (url.origin !== "http://plateflow.local" || isGuestPath) {
      return DEFAULT_AUTHENTICATED_ROUTE
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_AUTHENTICATED_ROUTE
  }
}

export { DEFAULT_AUTHENTICATED_ROUTE }
