import { io, type Socket } from "socket.io-client"

// The browser opens socket.io straight to the backend origin rather than through
// the Next /api/v1 rewrite (websocket proxying is unreliable on Next 16 /
// Turbopack). In dev that's the local backend; in production NEXT_PUBLIC_WS_URL
// must point at the public API origin.
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000"

type AuthPayload = Record<string, unknown>

// Either a static handshake payload (the diner's table token + order id) or a
// function that produces one — socket.io re-invokes the function before every
// (re)connection, which is how staff hand over a freshly-minted ticket each time
// rather than a stale ~60s one.
type SocketAuth = AuthPayload | ((cb: (data: AuthPayload) => void) => void)

// A dedicated connection the caller fully owns (forceNew): a hook disconnecting
// on unmount can't tear down a connection shared elsewhere in the app.
export function createSocket(auth: SocketAuth): Socket {
  return io(WS_URL, { forceNew: true, auth })
}
