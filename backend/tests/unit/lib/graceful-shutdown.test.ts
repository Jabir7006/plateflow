import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createShutdownHandler,
  type ShutdownDeps,
} from "../../../src/lib/graceful-shutdown.js";

function makeDeps(overrides: Partial<ShutdownDeps> = {}): ShutdownDeps {
  return {
    closeRealtime: vi.fn(),
    disconnectDb: vi.fn(),
    closePool: vi.fn(),
    forceCloseConnections: vi.fn(),
    exit: vi.fn(),
    log: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createShutdownHandler", () => {
  it("closes realtime, then the database and pool, then exits 0", async () => {
    const calls: string[] = [];
    const deps = makeDeps({
      closeRealtime: vi.fn(async () => {
        calls.push("realtime");
      }),
      disconnectDb: vi.fn(async () => {
        calls.push("database");
      }),
      closePool: vi.fn(async () => {
        calls.push("pool");
      }),
      exit: vi.fn((code: number) => {
        calls.push(`exit:${code}`);
      }),
    });

    await createShutdownHandler(deps)("SIGTERM");

    expect(calls).toEqual(["realtime", "database", "pool", "exit:0"]);
    expect(deps.forceCloseConnections).not.toHaveBeenCalled();
  });

  it("ignores a second signal while the first shutdown is running", async () => {
    let releaseRealtime!: () => void;
    const realtimeGate = new Promise<void>((resolve) => {
      releaseRealtime = resolve;
    });
    const deps = makeDeps({
      closeRealtime: vi.fn(() => realtimeGate),
    });
    const shutdown = createShutdownHandler(deps);

    const first = shutdown("SIGTERM");
    const second = shutdown("SIGTERM");
    releaseRealtime();
    await Promise.all([first, second]);

    expect(deps.closeRealtime).toHaveBeenCalledTimes(1);
    expect(deps.disconnectDb).toHaveBeenCalledTimes(1);
    expect(deps.closePool).toHaveBeenCalledTimes(1);
    expect(deps.exit).toHaveBeenCalledTimes(1);
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it("still closes the pool and exits 1 when a step fails", async () => {
    const deps = makeDeps({
      disconnectDb: vi.fn(() => Promise.reject(new Error("db down"))),
    });

    await createShutdownHandler(deps)("SIGTERM");

    expect(deps.closeRealtime).toHaveBeenCalledTimes(1);
    expect(deps.closePool).toHaveBeenCalledTimes(1);
    expect(deps.exit).toHaveBeenCalledWith(1);
    expect(deps.log).toHaveBeenCalledWith(
      "database shutdown failed",
      expect.any(Error)
    );
  });

  it("forces connections closed and exits 1 if a step hangs", async () => {
    vi.useFakeTimers();
    const deps = makeDeps({
      closeRealtime: vi.fn(() => new Promise<void>(() => undefined)),
    });
    const shutdown = createShutdownHandler(deps);

    void shutdown("SIGTERM");
    await vi.advanceTimersByTimeAsync(10_000);

    expect(deps.forceCloseConnections).toHaveBeenCalledTimes(1);
    expect(deps.exit).toHaveBeenCalledWith(1);
    expect(deps.disconnectDb).not.toHaveBeenCalled();
  });
});
