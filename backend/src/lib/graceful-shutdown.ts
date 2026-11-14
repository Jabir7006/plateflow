// Ordered, idempotent shutdown for a Render deploy or a local Ctrl-C.
//
// Render sends SIGTERM before replacing an instance. Without this, in-flight
// requests and socket.io connections are cut. The handler stops realtime, then
// disconnects Prisma and the pg pool, and force-exits if a step hangs so the
// platform's own kill timer is not the only backstop.

export interface ShutdownDeps {
  closeRealtime: () => Promise<void> | void;
  disconnectDb: () => Promise<void> | void;
  closePool: () => Promise<void> | void;
  forceCloseConnections: () => void;
  exit: (code: number) => void;
  log: (message: string, error?: unknown) => void;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export function createShutdownHandler(
  deps: ShutdownDeps
): (signal: string) => Promise<void> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let started = false;

  return async function shutdown(signal: string): Promise<void> {
    if (started) return;
    started = true;

    deps.log(`received ${signal}; shutting down`);

    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      deps.log(`shutdown exceeded ${timeoutMs}ms; forcing exit`);
      deps.forceCloseConnections();
      deps.exit(1);
    }, timeoutMs);
    timer.unref?.();

    const steps: Array<[string, () => Promise<void> | void]> = [
      ["realtime", deps.closeRealtime],
      // Prisma's pg adapter does not own the pool we pass it, so disconnect the
      // client and close the pool separately.
      ["database", deps.disconnectDb],
      ["pool", deps.closePool],
    ];

    let failed = false;
    for (const [name, step] of steps) {
      try {
        await step();
      } catch (error) {
        failed = true;
        deps.log(`${name} shutdown failed`, error);
      }
    }

    if (finished) return;
    finished = true;
    clearTimeout(timer);
    deps.log(failed ? "shutdown finished with errors" : "shutdown complete");
    deps.exit(failed ? 1 : 0);
  };
}
