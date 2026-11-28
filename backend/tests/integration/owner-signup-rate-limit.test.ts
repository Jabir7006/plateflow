import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/mail.js", () => ({
  sendEmail: vi.fn(),
  sendSignupEmail: vi.fn(),
}));

import { api, db, startServer, suffix, type TestServer } from "../harness.js";

let server: TestServer;
let request: ReturnType<typeof api>;
const emails: string[] = [];

const email = () => {
  const value = `limit-${suffix()}@example.com`;
  emails.push(value);
  return value;
};

const post = (path: string, body: unknown, expect: number) =>
  request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    expect,
  });

beforeAll(async () => {
  process.env.SELF_SERVE_SIGNUP_ENABLED = "true";
  process.env.RATE_LIMIT_ENABLED = "true";
  process.env.RATE_LIMIT_SIGNUP_REQUEST_MAX = "2";
  process.env.RATE_LIMIT_SIGNUP_LINK_MAX = "2";

  await db.connect();
  server = await startServer();
  request = api(server.baseUrl);
});

afterAll(async () => {
  await server?.close();
  if (emails.length > 0) {
    await db.query(
      'DELETE FROM "OwnerSignupChallenge" WHERE email = ANY($1::text[])',
      [emails]
    );
  }
});

describe("signup rate limits", () => {
  it("allows the configured number of requests per IP, then 429s", async () => {
    await post("/api/v1/auth/signup/request", { email: email() }, 202);
    await post("/api/v1/auth/signup/request", { email: email() }, 202);

    const limited = await post(
      "/api/v1/auth/signup/request",
      { email: email() },
      429
    );

    expect(limited.body.message).toMatch(/too many requests/i);
  });

  it("shares one bucket between verify and complete", async () => {
    // The limiter runs before validation, so an unusable token still counts.
    await post("/api/v1/auth/signup/verify", { token: "A".repeat(43) }, 400);
    await post("/api/v1/auth/signup/verify", { token: "A".repeat(43) }, 400);

    const limited = await post(
      "/api/v1/auth/signup/complete",
      { token: "A".repeat(43) },
      429
    );

    expect(limited.body.message).toMatch(/too many requests/i);
  });
});
