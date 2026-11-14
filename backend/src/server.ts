import { createServer } from "node:http";
import app from "./app.js";
import { ENV } from "./config/env.js";
import { prisma, pool } from "./lib/prisma.js";
import { createShutdownHandler } from "./lib/graceful-shutdown.js";
import { initRealtime } from "./realtime/realtime.js";

const { PORT } = ENV;

// socket.io needs the raw HTTP server to attach to, so we create it explicitly
// and hand Express to it rather than calling app.listen directly.
const httpServer = createServer(app);
const io = initRealtime(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Render sends SIGTERM before replacing an instance. io.close() disconnects
// clients and closes the HTTP server it is attached to; then release the
// database client and the pool. The handler force-exits if a step hangs.
const shutdown = createShutdownHandler({
  closeRealtime: () =>
    new Promise<void>((resolve, reject) => {
      io.close((error) => (error ? reject(error) : resolve()));
    }),
  disconnectDb: () => prisma.$disconnect(),
  closePool: () => pool.end(),
  forceCloseConnections: () => httpServer.closeAllConnections(),
  exit: (code) => process.exit(code),
  log: (message, error) => {
    if (error === undefined) console.log(message);
    else console.error(message, error);
  },
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}
