import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Signup mail is mocked: the suite asserts what would be sent (and that nothing
// is sent), not that Resend is reachable.
vi.mock("../../src/lib/mail.js", () => ({
  sendEmail: vi.fn(),
  sendSignupEmail: vi.fn(),
}));

import { sendSignupEmail } from "../../src/lib/mail.js";
import { compareValue } from "../../src/utils/bcrypt.js";
import { randomId, sha256 } from "../../src/utils/crypto.js";
import {
  api,
  db,
  provisionRestaurant,
  readCookie,
  removeFixtures,
  removeIssuedRefreshTokens,
  removeRestaurants,
  startServer,
  suffix,
  type Provisioned,
  type TestServer,
} from "../harness.js";

const mail = vi.mocked(sendSignupEmail);

// Deliberately a literal: importing the service would load config/env before
// beforeAll can flip SELF_SERVE_SIGNUP_ENABLED, and ENV is a frozen singleton.
const INVALID_SIGNUP_LINK =
  "This signup link is invalid or has expired. Request a new link.";

let server: TestServer;
let request: ReturnType<typeof api>;
let existing: Provisioned;

// Everything this suite creates, so teardown can remove it even when a test
// fails before it captured the returned ids.
const emails: string[] = [];

const json = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const newEmail = (label = "owner") => {
  // The form normalizes before storing, so fixtures start normalized too.
  const email = `${label}-${suffix()}@example.com`.toLowerCase();
  emails.push(email);
  return email;
};

function tokenFromLastMail(): { token: string; to: string } {
  const call = mail.mock.calls.at(-1);
  if (!call) throw new Error("no signup email was sent");

  const match = /#token=([A-Za-z0-9_-]{43})/.exec(call[0].text ?? "");
  if (!match?.[1]) throw new Error("signup email carried no link token");

  return { token: match[1], to: call[0].to };
}

async function requestLink(body: { email: string }, expect = 202) {
  return request("/api/v1/auth/signup/request", {
    ...json(body),
    expect,
  });
}

async function issueLink(email: string) {
  const before = mail.mock.calls.length;
  const result = await requestLink({ email });
  await vi.waitFor(() => expect(mail).toHaveBeenCalledTimes(before + 1));
  const { token, to } = tokenFromLastMail();
  expect(to).toBe(email);
  return { token, result };
}

const completeBody = (token: string, overrides: Record<string, unknown> = {}) => ({
  token,
  restaurantName: "Spice Garden",
  timeZone: "Asia/Dhaka",
  ownerName: "Asha Rahman",
  password: "correct horse battery",
  ...overrides,
});

async function complete(token: string, overrides: Record<string, unknown> = {}) {
  return request("/api/v1/auth/signup/complete", {
    ...json(completeBody(token, overrides)),
    expect: 201,
  });
}

beforeAll(async () => {
  // ENV is read when the app module loads, which happens inside startServer.
  process.env.SELF_SERVE_SIGNUP_ENABLED = "true";
  process.env.RATE_LIMIT_ENABLED = "false";

  await db.connect();
  server = await startServer();
  request = api(server.baseUrl);
  existing = await provisionRestaurant("Signup Existing Tenant");
});

beforeEach(() => {
  mail.mockClear();
});

afterAll(async () => {
  await server?.close();
  await removeFixtures();

  if (emails.length > 0) {
    // Signup-created tenants are found by their owner address, not a recorded
    // id, so a failed completion still gets cleaned up.
    const { rows } = await db.query<{ id: string }>(
      'SELECT "restaurantId" AS id FROM "User" WHERE email = ANY($1::text[])',
      [emails]
    );
    await removeRestaurants(rows.map((row) => row.id));
    await db.query(
      'DELETE FROM "OwnerSignupChallenge" WHERE email = ANY($1::text[])',
      [emails]
    );
  }

  await removeIssuedRefreshTokens();
});

describe("POST /auth/signup/request", () => {
  it("stores only the token digest and sends one link to the normalized address", async () => {
    const address = newEmail("Mixed");
    const mixedCase = `  ${address.toUpperCase()}  `;

    const { body } = await requestLink({ email: mixedCase });
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
    expect(body.message).toMatch(/if this address can sign up/i);

    await vi.waitFor(() => expect(mail).toHaveBeenCalledTimes(1));
    const { token, to } = tokenFromLastMail();
    expect(to).toBe(address);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const { rows } = await db.query<{
      email: string;
      tokenHash: string;
      resendAfter: Date;
    }>(
      // Prisma stores timestamps as naive UTC; the session's +06 zone would
      // otherwise shift a raw pg read by six hours.
      'SELECT email, "tokenHash", ("resendAfter" AT TIME ZONE \'UTC\') AS "resendAfter" FROM "OwnerSignupChallenge" WHERE email = $1',
      [address]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toBe(address);
    expect(rows[0]!.tokenHash).toBe(sha256(token));
    expect(rows[0]!.tokenHash).not.toBe(token);
    expect(rows[0]!.resendAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it("answers identically for an existing account and sends nothing", async () => {
    const { body, response } = await requestLink({ email: existing.email });

    expect(response.status).toBe(202);
    expect(body.message).toMatch(/if this address can sign up/i);
    expect(response.headers.get("cache-control")).toContain("no-store");

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mail).not.toHaveBeenCalled();

    const { rows } = await db.query(
      'SELECT 1 FROM "OwnerSignupChallenge" WHERE email = $1',
      [existing.email]
    );
    expect(rows).toHaveLength(0);
  });

  it("adds a second live link after the cooldown without retiring the first", async () => {
    const email = newEmail();
    const first = await issueLink(email);

    // Inside the cooldown nothing is inserted, so the first link stays valid.
    await requestLink({ email });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mail).toHaveBeenCalledTimes(1);
    expect(
      (await request("/api/v1/auth/signup/verify", { ...json({ token: first.token }), expect: 200 })).body.data
    ).toEqual({ email });

    // Simulate the cooldown having elapsed.
    await db.query(
      'UPDATE "OwnerSignupChallenge" SET "resendAfter" = (now() AT TIME ZONE \'UTC\') - $2::interval WHERE email = $1',
      [email, "1 second"]
    );

    const second = await issueLink(email);
    expect(second.token).not.toBe(first.token);
    expect(mail).toHaveBeenCalledTimes(2);

    const rows = await db.query(
      'SELECT 1 FROM "OwnerSignupChallenge" WHERE email = $1',
      [email]
    );
    expect(rows.rows).toHaveLength(2);

    for (const token of [first.token, second.token]) {
      const preview = await request("/api/v1/auth/signup/verify", {
        ...json({ token }),
        expect: 200,
      });
      expect(preview.body.data).toEqual({ email });
    }
  });

  it("serializes concurrent requests for one address into a single link", async () => {
    const email = newEmail("parallel");

    const [first, second] = await Promise.all([
      requestLink({ email }),
      requestLink({ email }),
    ]);
    expect(first.response.status).toBe(202);
    expect(second.response.status).toBe(202);

    await vi.waitFor(() => expect(mail).toHaveBeenCalledTimes(1));
    const rows = await db.query(
      'SELECT 1 FROM "OwnerSignupChallenge" WHERE email = $1',
      [email]
    );
    expect(rows.rows).toHaveLength(1);
  });

  it("still answers 202 when delivery fails and keeps the cooldown", async () => {
    const email = newEmail();
    mail.mockRejectedValueOnce(new Error("resend is down"));

    await requestLink({ email });
    await vi.waitFor(() => expect(mail).toHaveBeenCalledTimes(1));

    const { rows } = await db.query<{ resendAfter: Date }>(
      'SELECT ("resendAfter" AT TIME ZONE \'UTC\') AS "resendAfter" FROM "OwnerSignupChallenge" WHERE email = $1',
      [email]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.resendAfter.getTime()).toBeGreaterThan(Date.now());

    await requestLink({ email });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mail).toHaveBeenCalledTimes(1);
  });
});

describe("POST /auth/signup/verify", () => {
  it("returns the email for a live link without writing anything", async () => {
    const email = newEmail();
    const { token } = await issueLink(email);
    const before = await db.query(
      'SELECT "expiresAt" FROM "OwnerSignupChallenge" WHERE email = $1',
      [email]
    );

    const { body } = await request("/api/v1/auth/signup/verify", {
      ...json({ token }),
      expect: 200,
    });

    expect(body.data).toEqual({ email });
    const after = await db.query(
      'SELECT "expiresAt" FROM "OwnerSignupChallenge" WHERE email = $1',
      [email]
    );
    expect(after.rows).toEqual(before.rows);
  });

  it("returns one generic 400 for unknown and expired links", async () => {
    const unknown = await request("/api/v1/auth/signup/verify", {
      ...json({ token: "A".repeat(43) }),
      expect: 400,
    });
    expect(unknown.body.message).toBe(INVALID_SIGNUP_LINK);

    const email = newEmail();
    const { token } = await issueLink(email);
    await db.query(
      'UPDATE "OwnerSignupChallenge" SET "expiresAt" = (now() AT TIME ZONE \'UTC\') - $2::interval WHERE email = $1',
      [email, "1 second"]
    );

    const expired = await request("/api/v1/auth/signup/verify", {
      ...json({ token }),
      expect: 400,
    });
    expect(expired.body.message).toBe(INVALID_SIGNUP_LINK);
  });
});

describe("POST /auth/signup/complete", () => {
  it("creates the tenant, first OWNER and session in one transaction", async () => {
    const email = newEmail();
    const { token } = await issueLink(email);

    const { response, body } = await request("/api/v1/auth/signup/complete", {
      ...json(
        completeBody(token, {
          restaurantName: "  Spice Garden  ",
          ownerName: "  Asha Rahman  ",
        })
      ),
      expect: 201,
    });

    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.data).toMatchObject({
      email,
      fullName: "Asha Rahman",
      role: "OWNER",
      status: "ACTIVE",
      restaurant: { name: "Spice Garden" },
    });

    const restaurantId = body.data.restaurant.id;
    const accessToken = readCookie(response, "accessToken");
    expect(accessToken).toBeTruthy();

    const { rows } = await db.query<{
      status: string;
      role: string;
      password: string;
      timeZone: string;
      slug: string;
    }>(
      `SELECT u.status, u.role, u.password, r."timeZone", r.slug
         FROM "User" u JOIN "Restaurant" r ON r.id = u."restaurantId"
        WHERE u.email = $1`,
      [email]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "ACTIVE", role: "OWNER" });
    expect(rows[0]!.timeZone).toBe("Asia/Dhaka");
    expect(rows[0]!.slug).toMatch(/^signup-[0-9a-f]{24}$/);
    expect(rows[0]!.password).not.toBe("correct horse battery");
    expect(await compareValue("correct horse battery", rows[0]!.password)).toBe(
      true
    );

    const challenge = await db.query(
      'SELECT 1 FROM "OwnerSignupChallenge" WHERE email = $1',
      [email]
    );
    expect(challenge.rows).toHaveLength(0);

    // The first refresh session committed with the account, so the cookie the
    // browser just received restores the same user.
    const me = await request("/api/v1/auth/me", {
      headers: { Cookie: `accessToken=${accessToken}` },
      expect: 200,
    });
    expect(me.body.data.id).toBe(body.data.id);

    // Single use: spending the link again creates nothing and does not 500.
    const replay = await request("/api/v1/auth/signup/complete", {
      ...json(completeBody(token)),
      expect: 400,
    });
    expect(replay.body.message).toBe(INVALID_SIGNUP_LINK);

    const owners = await db.query(
      'SELECT 1 FROM "User" WHERE email = $1 AND "restaurantId" = $2',
      [email, restaurantId]
    );
    expect(owners.rows).toHaveLength(1);
  });

  it("retires every outstanding link once an older one completes", async () => {
    const email = newEmail("multi");
    const first = await issueLink(email);

    await db.query(
      'UPDATE "OwnerSignupChallenge" SET "resendAfter" = (now() AT TIME ZONE \'UTC\') - $2::interval WHERE email = $1',
      [email, "1 second"]
    );
    const second = await issueLink(email);
    expect(second.token).not.toBe(first.token);

    await complete(first.token);

    // Completion deletes all sibling challenges for the address in the same
    // transaction, so the later link cannot create a second tenant.
    const replay = await request("/api/v1/auth/signup/complete", {
      ...json(completeBody(second.token)),
      expect: 400,
    });
    expect(replay.body.message).toBe(INVALID_SIGNUP_LINK);

    const challenges = await db.query(
      'SELECT 1 FROM "OwnerSignupChallenge" WHERE email = $1',
      [email]
    );
    expect(challenges.rows).toHaveLength(0);

    const users = await db.query(
      'SELECT 1 FROM "User" WHERE email = $1',
      [email]
    );
    expect(users.rows).toHaveLength(1);
  });

  it("refuses a fixed-offset or extra fields without consuming the link", async () => {
    const email = newEmail();
    const { token } = await issueLink(email);

    const offset = await request("/api/v1/auth/signup/complete", {
      ...json(completeBody(token, { timeZone: "+06:00" })),
      expect: 400,
    });
    expect(offset.body.errors[0]).toEqual({
      field: "body.timeZone",
      message: "Choose a valid named IANA time zone",
    });

    const extra = await request("/api/v1/auth/signup/complete", {
      ...json(completeBody(token, { email: "attacker@example.com" })),
      expect: 400,
    });
    expect(extra.body.message).toBe("Validation failed");

    const weak = await request("/api/v1/auth/signup/complete", {
      ...json(completeBody(token, { password: "eleven char" })),
      expect: 400,
    });
    expect(weak.body.message).toBe("Validation failed");

    // Every rejection rolled back before claiming: the live link still works.
    const challenge = await db.query(
      'SELECT "expiresAt" FROM "OwnerSignupChallenge" WHERE email = $1',
      [email]
    );
    expect(challenge.rows).toHaveLength(1);

    await complete(token);
  });

  it("returns a generic 409 and rolls back when the email was claimed concurrently", async () => {
    const email = newEmail("race");
    const { token } = await issueLink(email);

    // The address gains an account on another tenant after the link was issued.
    await db.query(
      `INSERT INTO "User" (id, "fullName", email, role, status, "restaurantId")
       VALUES ($1, $2, $3, 'WAITER', 'ACTIVE', $4)`,
      [randomId(12), "Concurrent Claim", email, existing.restaurantId]
    );

    const conflict = await request("/api/v1/auth/signup/complete", {
      ...json(completeBody(token)),
      expect: 409,
    });
    expect(conflict.body.message).toMatch(/sign in instead/i);

    // The whole transaction rolled back, including the token claim.
    const challenge = await db.query(
      'SELECT 1 FROM "OwnerSignupChallenge" WHERE email = $1',
      [email]
    );
    expect(challenge.rows).toHaveLength(1);

    const users = await db.query<{ restaurantId: string }>(
      'SELECT "restaurantId" FROM "User" WHERE email = $1',
      [email]
    );
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0]!.restaurantId).toBe(existing.restaurantId);
  });

  it("creates exactly one tenant when the same link is completed concurrently", async () => {
    const email = newEmail("concurrent");
    const { token } = await issueLink(email);

    const send = () =>
      fetch(`${server.baseUrl}/api/v1/auth/signup/complete`, {
        ...json(completeBody(token)),
      });

    const [first, second] = await Promise.all([send(), send()]);
    expect([first.status, second.status].sort()).toEqual([201, 400]);

    const { rows } = await db.query(
      'SELECT 1 FROM "User" WHERE email = $1',
      [email]
    );
    expect(rows).toHaveLength(1);
  });
});
