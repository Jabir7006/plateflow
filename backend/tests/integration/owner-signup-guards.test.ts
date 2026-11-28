import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/mail.js", () => ({
  sendEmail: vi.fn(),
  sendSignupEmail: vi.fn(),
}));

import { sendSignupEmail } from "../../src/lib/mail.js";
import { api, startServer, suffix, type TestServer } from "../harness.js";

const mail = vi.mocked(sendSignupEmail);

let server: TestServer;
let request: ReturnType<typeof api>;
let appOrigin: string;

const email = () => `guard-${suffix()}@example.com`;

const post = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
  expect = 200
) =>
  request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    expect,
  });

beforeAll(async () => {
  process.env.SELF_SERVE_SIGNUP_ENABLED = "true";
  process.env.RATE_LIMIT_ENABLED = "false";
  // Small enough to exercise the 413 path cheaply; signup bodies are tiny.
  process.env.JSON_BODY_LIMIT = "2kb";

  server = await startServer();
  request = api(server.baseUrl);
  appOrigin = new URL(process.env.APP_URL!).origin;
});

afterAll(async () => {
  await server?.close();
});

describe("signup browser origin", () => {
  it("rejects a supplied origin other than APP_URL with 403 and no-store", async () => {
    const { body, response } = await post(
      "/api/v1/auth/signup/request",
      { email: email() },
      { Origin: "https://evil.example" },
      403
    );

    expect(body.message).toBe("Request origin is not allowed");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mail).not.toHaveBeenCalled();
  });

  it("rejects an unparseable origin the same way", async () => {
    const { body } = await post(
      "/api/v1/auth/signup/request",
      { email: email() },
      { Origin: "not a url" },
      403
    );

    expect(body.message).toBe("Request origin is not allowed");
  });

  it("accepts APP_URL's origin and an omitted origin", async () => {
    await post(
      "/api/v1/auth/signup/request",
      { email: email() },
      { Origin: appOrigin },
      202
    );
    await post("/api/v1/auth/signup/request", { email: email() }, {}, 202);

    await vi.waitFor(() => expect(mail).toHaveBeenCalledTimes(2));
  });

  it("requires JSON bodies", async () => {
    const { body } = await request("/api/v1/auth/signup/request", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ email: email() }),
      expect: 415,
    });

    expect(body.message).toBe("Content-Type must be application/json");
  });

  it("rejects extra fields on the request body", async () => {
    const { body } = await post(
      "/api/v1/auth/signup/request",
      { email: email(), role: "OWNER" },
      {},
      400
    );

    expect(body.message).toBe("Validation failed");
  });

  it("keeps no-store on malformed JSON and oversized bodies", async () => {
    const malformed = await request("/api/v1/auth/signup/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"email":',
      expect: 400,
    });
    expect(malformed.body.message).toBe("Invalid JSON payload");
    expect(malformed.response.headers.get("cache-control")).toContain(
      "no-store"
    );

    const oversized = await request("/api/v1/auth/signup/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email(), padding: "a".repeat(3_000) }),
      expect: 413,
    });
    expect(oversized.body.message).toBe("Request body is too large");
    expect(oversized.response.headers.get("cache-control")).toContain(
      "no-store"
    );
  });
});
