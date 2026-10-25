import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TOKEN_TTL } from "../../src/constants/auth.js";
import { sha256 } from "../../src/utils/crypto.js";
import {
  api,
  createStaffUser,
  db,
  login,
  provisionRestaurant,
  readCookie,
  removeFixtures,
  removeIssuedRefreshTokens,
  startServer,
  type Provisioned,
  type TestServer,
} from "../harness.js";

// The session is the only credential the dashboard has. These cases cover what
// happens when it is rotated (including replay), revoked, or held by an account
// that is disabled while it is still valid.

let server: TestServer;
let request: ReturnType<typeof api>;
let owner: Provisioned;

const loginBody = (email: string, password: string) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

const refresh = (refreshToken: string) =>
  request("/api/v1/auth/refresh", {
    method: "POST",
    headers: { Cookie: `refreshToken=${refreshToken}` },
  });

const setCookieStartingWith = (response: Response, name: string) =>
  response.headers
    .getSetCookie()
    .find((header) => header.startsWith(`${name}=`) && !header.startsWith(`${name}=;`));

beforeAll(async () => {
  await db.connect();
  server = await startServer();
  request = api(server.baseUrl);
  owner = await provisionRestaurant("Auth Flow");
});

afterAll(async () => {
  await server?.close();
  await removeIssuedRefreshTokens();
  await removeFixtures();
  await db.end();
});

describe("login", () => {
  it("issues an httpOnly, strict, path-scoped session for the right restaurant", async () => {
    const { response, body } = await request("/api/v1/auth/login", {
      ...loginBody(owner.email, owner.password),
      expect: 200,
    });

    expect(body.data).toMatchObject({
      id: owner.ownerId,
      email: owner.email,
      status: "ACTIVE",
      restaurant: { id: owner.restaurantId, name: "Auth Flow" },
    });

    const access = setCookieStartingWith(response, "accessToken");
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=Strict/i);
    expect(access).toMatch(/Path=\/api\/v1(;|$)/);
    expect(access).toMatch(new RegExp(`Max-Age=${TOKEN_TTL.ACCESS / 1000}`));

    const issuedRefresh = setCookieStartingWith(response, "refreshToken");
    expect(issuedRefresh).toMatch(/HttpOnly/i);
    expect(issuedRefresh).toMatch(/Path=\/api\/v1\/auth(;|$)/);
    expect(issuedRefresh).toMatch(new RegExp(`Max-Age=${TOKEN_TTL.REFRESH / 1000}`));
  });

  it("answers wrong passwords and unknown emails identically", async () => {
    const attempts = [
      { email: owner.email, password: "definitely-wrong" },
      { email: `missing-${Date.now()}@example.com`, password: "definitely-wrong" },
    ];

    for (const attempt of attempts) {
      const { body } = await request("/api/v1/auth/login", {
        ...loginBody(attempt.email, attempt.password),
        expect: 401,
      });
      expect(body.message).toBe("Invalid email or password");
    }
  });

  it("rejects malformed input before touching the database", async () => {
    const badEmail = await request("/api/v1/auth/login", {
      ...loginBody("not-an-email", "secret123"),
      expect: 400,
    });
    expect(badEmail.body.errors[0].field).toBe("body.email");

    const shortPassword = await request("/api/v1/auth/login", {
      ...loginBody(owner.email, "12345"),
      expect: 400,
    });
    expect(shortPassword.body.errors[0].field).toBe("body.password");
  });

  it("rejects a malformed JSON body as a client error", async () => {
    const { body } = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
      expect: 400,
    });

    expect(body.message).toBe("Invalid JSON payload");
  });
});

describe("/me", () => {
  it("requires a session", async () => {
    await request("/api/v1/auth/me", { expect: 401 });
  });

  it("returns the caller's own account and tenant", async () => {
    const session = await login(request, owner.email, owner.password);
    const { body } = await request("/api/v1/auth/me", {
      headers: session.headers,
    });

    expect(body.data).toMatchObject({
      id: owner.ownerId,
      restaurant: { id: owner.restaurantId, name: "Auth Flow" },
    });
  });
});

describe("refresh rotation", () => {
  it("rotates the refresh token and keeps the session usable", async () => {
    const session = await login(request, owner.email, owner.password);
    expect(session.refreshToken).toBeTruthy();

    const first = await refresh(session.refreshToken!);
    const rotated = readCookie(first.response, "refreshToken");

    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(session.refreshToken);
    expect(first.body.data.restaurant.id).toBe(owner.restaurantId);

    // The sibling request that lost the race is told to retry, not logged out.
    await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { Cookie: `refreshToken=${session.refreshToken}` },
      expect: 409,
    });

    // The winner's token is untouched by that conflict.
    const second = await refresh(rotated!);
    expect(readCookie(second.response, "refreshToken")).not.toBe(rotated);
  });

  it("revokes the whole session when an old token is replayed after the grace window", async () => {
    const session = await login(request, owner.email, owner.password);
    const first = await refresh(session.refreshToken!);
    const rotated = readCookie(first.response, "refreshToken")!;

    // Age the rotated row well past the grace period instead of waiting 10
    // seconds. Prisma stores DateTime as `timestamp without time zone` in UTC,
    // and the database clock can run a few seconds ahead of the app host, so the
    // margin is minutes rather than seconds.
    const updated = await db.query(
      `UPDATE "RefreshToken"
          SET "revokedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '2 minutes'
        WHERE "tokenHash" = $1`,
      [sha256(session.refreshToken!)]
    );
    expect(updated.rowCount).toBe(1);

    const replayed = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { Cookie: `refreshToken=${session.refreshToken}` },
      expect: 401,
    });
    expect(replayed.body.message).toMatch(/ended for security reasons/i);

    // Reuse is treated as theft: the legitimate sibling token dies too.
    await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { Cookie: `refreshToken=${rotated}` },
      expect: 401,
    });
  });

  it("rejects a missing or unverifiable refresh token and clears cookies", async () => {
    const missing = await request("/api/v1/auth/refresh", {
      method: "POST",
      expect: 401,
    });
    expect(
      missing.response.headers.getSetCookie().some((c) => c.startsWith("accessToken=;"))
    ).toBe(true);

    const garbage = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { Cookie: "refreshToken=not-a-jwt" },
      expect: 401,
    });
    expect(
      garbage.response.headers.getSetCookie().some((c) => c.startsWith("accessToken=;"))
    ).toBe(true);
  });
});

describe("logout", () => {
  it("revokes the refresh token and refuses to resume the session", async () => {
    const session = await login(request, owner.email, owner.password);

    const out = await request("/api/v1/auth/logout", {
      method: "POST",
      headers: { Cookie: `refreshToken=${session.refreshToken}` },
    });
    expect(out.body.message).toBe("Logged out successfully");

    const resumed = await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { Cookie: `refreshToken=${session.refreshToken}` },
      expect: 401,
    });
    expect(resumed.body.message).toMatch(/no longer valid/i);
  });
});

describe("disabled accounts", () => {
  it("can no longer use an access token or refresh a live session", async () => {
    const staff = await createStaffUser({
      restaurantId: owner.restaurantId,
      role: "WAITER",
    });
    const session = await login(request, staff.email, staff.password);

    await db.query('UPDATE "User" SET status = $1 WHERE id = $2', [
      "DISABLED",
      staff.id,
    ]);

    await request("/api/v1/auth/me", {
      headers: session.headers,
      expect: 403,
    });

    await request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { Cookie: `refreshToken=${session.refreshToken}` },
      expect: 403,
    });

    const revoked = await db.query<{ revokedReason: string }>(
      'SELECT "revokedReason" FROM "RefreshToken" WHERE "userId" = $1 AND "revokedReason" IS NOT NULL',
      [staff.id]
    );
    expect(revoked.rows.map((row) => row.revokedReason)).toContain("USER_DISABLED");

    await request("/api/v1/auth/login", {
      ...loginBody(staff.email, staff.password),
      expect: 403,
    });
  });
});
