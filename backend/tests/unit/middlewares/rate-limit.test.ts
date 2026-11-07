import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRateLimiter } from "../../../src/middlewares/rate-limit.middleware.js";

// Exercises the limiter itself over real HTTP: disabled is a pass-through,
// enabled blocks with the project's JSON error shape, and the standardized
// headers are present so a client can back off before it is blocked.

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();

  const enabled = createRateLimiter({
    enabled: true,
    windowMs: 60_000,
    limit: 2,
  });
  const disabled = createRateLimiter({
    enabled: false,
    windowMs: 60_000,
    limit: 1,
  });

  app.get("/enabled", enabled, (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/disabled", disabled, (_req, res) => {
    res.json({ ok: true });
  });

  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("createRateLimiter", () => {
  it("passes every request through when disabled", async () => {
    // The limit is 1, so repeated requests prove the disabled limiter never
    // records or blocks.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`${baseUrl}/disabled`);
      expect(response.status).toBe(200);
      expect(response.headers.get("ratelimit")).toBeNull();
    }
  });

  it("allows the configured number of requests and then blocks", async () => {
    const first = await fetch(`${baseUrl}/enabled`);
    const second = await fetch(`${baseUrl}/enabled`);
    const third = await fetch(`${baseUrl}/enabled`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);

    // A successful response advertises the quota with the standardized headers
    // so a client can back off before it is blocked.
    expect(first.headers.get("ratelimit")).not.toBeNull();
    expect(first.headers.get("ratelimit-policy")).not.toBeNull();
    expect(third.headers.get("retry-after")).not.toBeNull();

    await expect(third.json()).resolves.toEqual({
      success: false,
      statusCode: 429,
      message: "Too many requests. Please wait a moment and try again.",
    });
  });
});
