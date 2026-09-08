const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Single source of truth for token lifetimes.
 *
 * The same durations are needed by the JWT signer (`expiresIn`), the cookie
 * `maxAge`, and the `RefreshToken` rows persisted for rotation. Keeping them in
 * one place stops the three from drifting apart — a cookie that outlives its
 * token, or a database row that outlives its cookie, produces confusing
 * "randomly logged out" bugs.
 */
export const TOKEN_TTL = {
  ACCESS: 15 * MINUTE,
  REFRESH: 30 * DAY,
  SESSION_ABSOLUTE: 90 * DAY,
} as const;

export const REFRESH_REUSE_GRACE = 10 * SECOND;

export const REFRESH_TOKEN_RETENTION = 30 * DAY;
