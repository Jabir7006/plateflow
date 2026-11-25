// Reporting can use a deterministic clock in tests without freezing Date for
// the real HTTP/socket/database clients and their timeout bookkeeping.
export const reportingClock = {
  now: () => Date.now(),
};
