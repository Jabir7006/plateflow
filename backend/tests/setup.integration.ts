import "dotenv/config";
import { vi } from "vitest";

// The suite provisions and deletes real rows, so it must never inherit whatever
// database the app happens to point at. `TEST_DATABASE_URL` is a deliberate
// designation — a hostname check cannot tell a Neon dev branch from production.
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  throw new Error(
    "Refusing to run the test suite: set TEST_DATABASE_URL to a disposable " +
      "database. The suite creates and deletes restaurants, so it will not " +
      "fall back to DATABASE_URL."
  );
}

// Point the app and the harness at that one database. Both are derived from the
// same value so the guard and the `pg` client used for cleanup cannot end up on
// different databases.
process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_URL = testDatabaseUrl;

process.env.NODE_ENV = "test";
process.env.MAIL_FROM ??= "PlateFlow Tests <onboarding@resend.dev>";

// Many cases deliberately provoke errors, and the error middleware logs each
// one. Keep the reporter readable; set DEBUG_TESTS=1 to see the server's logs
// while diagnosing a failure.
if (!process.env.DEBUG_TESTS) {
  vi.spyOn(console, "error").mockImplementation(() => {});
}
