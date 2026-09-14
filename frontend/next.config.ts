import type { NextConfig } from "next"

const DEV_BACKEND_URL = "http://localhost:4000"

// Rewrites are baked into the build output, so this must be set when building
// for production. Without it every /api/v1 request would silently point at
// localhost and the whole app would fail with no build-time signal.
if (process.env.NODE_ENV === "production" && !process.env.BACKEND_URL) {
  throw new Error(
    "BACKEND_URL must be set for a production build (e.g. https://api.example.com). " +
      "It is read at build time, not at runtime."
  )
}

const BACKEND_URL = process.env.BACKEND_URL || DEV_BACKEND_URL

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
