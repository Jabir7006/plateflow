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
  // Keep dynamic route segments in the client router cache for a few minutes so
  // navigating back to the menu (e.g. from the order-status page) is instant and
  // doesn't re-run the server fetch — otherwise loading.tsx flashes every time.
  // The server fetch still revalidates on its own 60s window.
  experimental: {
    staleTimes: {
      dynamic: 180,
    },
  },
  images: {
    // Menu photos are Cloudinary delivery URLs (f_auto,q_auto already baked in
    // by the backend). Allow only our cloud so next/image can optimise them.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dkzqijrkd/**",
      },
    ],
  },
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
