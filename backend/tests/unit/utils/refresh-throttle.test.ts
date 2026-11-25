import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRefreshThrottle } from "@plateflow/shared";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("refresh throttle", () => {
  it("refreshes immediately and coalesces a burst into one trailing refresh", () => {
    const refresh = vi.fn();
    const throttle = createRefreshThrottle(refresh);
    throttle.schedule();
    expect(refresh).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(200);
      throttle.schedule();
    }
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(999);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(3_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("continues refreshing every interval during a continuous rush", () => {
    const refresh = vi.fn();
    const throttle = createRefreshThrottle(refresh);
    throttle.schedule();
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(500);
      throttle.schedule();
    }
    expect(refresh).toHaveBeenCalledTimes(4); // 0, 3s, 6s, 9s
    vi.advanceTimersByTime(2_000);
    expect(refresh).toHaveBeenCalledTimes(5); // final pending update at 12s
  });

  it("manual refresh runs immediately and cancels the pending trailing call", () => {
    const refresh = vi.fn();
    const throttle = createRefreshThrottle(refresh);
    throttle.schedule();
    vi.advanceTimersByTime(500);
    throttle.schedule();
    vi.advanceTimersByTime(500);
    throttle.flush();
    expect(refresh).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(2_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    throttle.schedule();
    vi.advanceTimersByTime(1_000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("cancels pending work on unmount or identity change and resets the window", () => {
    const refresh = vi.fn();
    const throttle = createRefreshThrottle(refresh);
    throttle.schedule();
    vi.advanceTimersByTime(200);
    throttle.schedule();
    throttle.cancel();
    vi.advanceTimersByTime(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    throttle.schedule();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
