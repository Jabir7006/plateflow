import { createHash, randomBytes } from "node:crypto";

/**
 * SHA-256 digest, hex encoded.
 *
 * Used to fingerprint refresh tokens before storing them, so the database only
 * ever holds a digest. A plain hash is the right tool here rather than bcrypt:
 * refresh tokens are high-entropy values with no dictionary to brute-force, and
 * the lookup has to stay a single indexed query.
 */
export const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

/**
 * URL-safe random identifier from the platform CSPRNG. Used for session ids and
 * refresh token JTIs, where uniqueness and unguessability both matter.
 */
export const randomId = (bytes: number = 32): string =>
  randomBytes(bytes).toString("base64url");
