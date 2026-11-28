import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/mail.js", () => ({
  sendEmail: vi.fn(),
  sendSignupEmail: vi.fn(),
}));

import { sendSignupEmail } from "../../src/lib/mail.js";
import { api, startServer, type TestServer } from "../harness.js";

const mail = vi.mocked(sendSignupEmail);

let server: TestServer;
let request: ReturnType<typeof api>;

const post = (path: string, body: unknown) =>
  request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    expect: 404,
  });

beforeAll(async () => {
  // The default: the feature stays dark until the deployment opts in.
  process.env.SELF_SERVE_SIGNUP_ENABLED = "false";
  process.env.JSON_BODY_LIMIT = "2kb";

  server = await startServer();
  request = api(server.baseUrl);
});

afterAll(async () => {
  await server?.close();
});

describe("self-serve signup disabled", () => {
  it("answers 404 on every signup route without revealing the feature", async () => {
    for (const [path, body] of [
      ["/api/v1/auth/signup/request", { email: "owner@example.com" }],
      ["/api/v1/auth/signup/verify", { token: "A".repeat(43) }],
      [
        "/api/v1/auth/signup/complete",
        {
          token: "A".repeat(43),
          restaurantName: "Spice Garden",
          timeZone: "Asia/Dhaka",
          ownerName: "Asha Rahman",
          password: "correct horse battery",
        },
      ],
    ] as const) {
      const { body: responseBody, response } = await post(path, body);

      expect(responseBody.message, path).toBe("Not found");
      expect(response.headers.get("cache-control"), path).toContain("no-store");
    }

    expect(mail).not.toHaveBeenCalled();
  });

  it("hides the routes before parsing, even for malformed or oversized bodies", async () => {
    for (const body of ['{"email":', JSON.stringify({ padding: "a".repeat(3_000) })]) {
      const { body: responseBody, response } = await request(
        "/api/v1/auth/signup/request",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          expect: 404,
        }
      );

      expect(responseBody.message).toBe("Not found");
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
  });
});
