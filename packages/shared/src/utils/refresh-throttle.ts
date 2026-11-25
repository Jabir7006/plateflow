// A leading refresh with one bounded trailing refresh. Unlike a debounce,
// continuous events cannot keep postponing the last pending refresh forever.
export function createRefreshThrottle(refresh: () => void, intervalMs = 3_000) {
  let lastRefresh = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function flush() {
    clearTimer();
    lastRefresh = performance.now();
    refresh();
  }

  function schedule() {
    const remaining = intervalMs - (performance.now() - lastRefresh);
    if (remaining <= 0) {
      flush();
    } else if (timer === undefined) {
      timer = setTimeout(flush, remaining);
    }
  }

  function cancel() {
    clearTimer();
    lastRefresh = Number.NEGATIVE_INFINITY;
  }

  return { schedule, flush, cancel };
}
