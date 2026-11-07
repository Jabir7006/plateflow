import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Public-surface hardening, end to end against the real app: security headers
// are always present, an oversized body is a clean 413, and the public read and
// write quotas return the project's JSON 429 shape once exhausted.
//
// Limits are off outside production by default, so this file turns them on
// before the app module reads its config. The previous values are restored when
// the file finishes so a later suite still starts with rate limiting off.

const OVERRIDES = {
  RATE_LIMIT_ENABLED: "true",
  RATE_LIMIT_WINDOW_MS: "60000",
  RATE_LIMIT_PUBLIC_MAX: "3",
  RATE_LIMIT_WRITE_MAX: "2",
  JSON_BODY_LIMIT: "1kb",
} as const;

const previousEnv = new Map<string, string | undefined>();

for (const [key, value] of Object.entries(OVERRIDES)) {
  previousEnv.set(key, process.env[key]);
  process.env[key] = value;
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { default: app } = await import("../../src/app.js");

  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));

  for (const [key, value] of previousEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("security headers", () => {
  it("sets the baseline headers on a normal response", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "cross-origin"
    );
    expect(response.headers.get("x-powered-by")).toBeNull();
  });

  it("keeps CSP and HSTS off outside production", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.headers.get("strict-transport-security")).toBeNull();
  });
});

describe("request body limit", () => {
  it("rejects an oversized JSON body with a 413", async () => {
    // JSON_BODY_LIMIT is 1kb for this file; the padding pushes it well past.
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "a@example.com",
        password: "x".repeat(2048),
      }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      success: false,
      statusCode: 413,
      message: "Request body is too large",
    });

    // The headers are applied before body parsing, so an error response still
    // carries them.
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("public rate limits", () => {
  it("answers a diner with a JSON 429 once the read quota is spent", async () => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/v1/t/not-a-real-token`);
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 3)).not.toContain(429);
    expect(statuses[3]).toBe(429);

    const blocked = await fetch(`${baseUrl}/api/v1/t/not-a-real-token`);
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toEqual({
      success: false,
      statusCode: 429,
      message: "Too many requests. Please wait a moment and try again.",
    });
  });

  it("answers a diner with a JSON 429 once the write quota is spent", async () => {
    const placement = () =>
      fetch(`${baseUrl}/api/v1/t/not-a-real-token/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [] }),
      });

    const first = await placement();
    const second = await placement();
    const third = await placement();

    expect(first.status).not.toBe(429);
    expect(second.status).not.toBe(429);
    expect(third.status).toBe(429);
    await expect(third.json()).resolves.toMatchObject({
      success: false,
      statusCode: 429,
    });
  });
});
