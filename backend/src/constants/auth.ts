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
  STAFF_INVITE: 7 * DAY,
  // A self-serve signup link proves one email for long enough to fill the form,
  // but no longer. Rotation and expiry are both enforced at completion.
  OWNER_SIGNUP: 30 * MINUTE,
} as const;

// One link per address per cooldown. Also the serialization window for
// concurrent requests across IPs.
export const SIGNUP_RESEND_COOLDOWN = 60 * SECOND;

export const REFRESH_REUSE_GRACE = 10 * SECOND;

export const REFRESH_TOKEN_RETENTION = 30 * DAY;
