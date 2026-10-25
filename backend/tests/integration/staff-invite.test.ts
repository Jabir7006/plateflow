import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Invitations are the only way into a restaurant other than provisioning. The
// mail call is mocked: the suite asserts what would be sent, not that Resend is
// reachable.
vi.mock("../../src/lib/mail.js", () => ({
  sendEmail: vi.fn(),
}));

import { sendEmail } from "../../src/lib/mail.js";
import { TOKEN_TTL } from "../../src/constants/auth.js";
import AppError from "../../src/utils/AppError.js";
import { compareValue } from "../../src/utils/bcrypt.js";
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
  type Session,
  type TestServer,
} from "../harness.js";

const mail = vi.mocked(sendEmail);

let server: TestServer;
let request: ReturnType<typeof api>;
let restaurant: Provisioned;
let owner: Session;
let manager: Session;
let waiter: Session;

const json = (body: unknown, headers: Record<string, string>) => ({
  method: "POST",
  headers,
  body: JSON.stringify(body),
});

async function invite(
  session: Session,
  body: { fullName: string; email: string; role: string },
  expect = 201
) {
  const result = await request("/api/v1/staff/invite", {
    ...json(body, session.headers),
    expect,
  });
  return result;
}

async function verify(token: string, expect = 200) {
  return request(`/api/v1/auth/verify-invite?token=${encodeURIComponent(token)}`, {
    expect,
  });
}

async function accept(token: string, password: string, expect = 201) {
  return request("/api/v1/auth/accept-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
    expect,
  });
}

const uniqueEmail = () => `invitee-${Date.now()}-${Math.random()}@example.com`;

function sentInvite() {
  const call = mail.mock.calls.at(-1);
  if (!call) throw new Error("sendEmail was not called");

  const message = call[0];
  const match = message.text.match(/accept-invite\?token=([A-Za-z0-9_-]+)/);
  if (!match?.[1]) throw new Error("the invite email carried no token");

  return { message, token: match[1] };
}

beforeAll(async () => {
  await db.connect();
  server = await startServer();
  request = api(server.baseUrl);
  restaurant = await provisionRestaurant("Staff Invite");
  owner = await login(request, restaurant.email, restaurant.password);

  const managerFixture = await createStaffUser({
    restaurantId: restaurant.restaurantId,
    role: "MANAGER",
  });
  manager = await login(request, managerFixture.email, managerFixture.password);

  const waiterFixture = await createStaffUser({
    restaurantId: restaurant.restaurantId,
    role: "WAITER",
  });
  waiter = await login(request, waiterFixture.email, waiterFixture.password);
});

beforeEach(() => {
  mail.mockReset();
  mail.mockResolvedValue(undefined);
});

afterAll(async () => {
  await server?.close();
  await removeIssuedRefreshTokens();
  await removeFixtures();
  await db.end();
});

describe("sending an invitation", () => {
  it("creates an invited account and stores only a digest of the link", async () => {
    const email = uniqueEmail();
    const { body } = await invite(owner, {
      fullName: "Nadia Rahman",
      email,
      role: "WAITER",
    });

    expect(body.data).toMatchObject({
      fullName: "Nadia Rahman",
      email,
      role: "WAITER",
      status: "INVITED",
    });

    const user = await db.query<{
      id: string;
      status: string;
      password: string | null;
      restaurantId: string;
    }>('SELECT id, status, password, "restaurantId" FROM "User" WHERE email = $1', [
      email,
    ]);
    expect(user.rows[0]).toMatchObject({
      status: "INVITED",
      password: null,
      restaurantId: restaurant.restaurantId,
    });

    const { message, token } = sentInvite();
    expect(message.to).toBe(email);
    expect(message.subject).toContain("Waiter");
    expect(message.text).toContain("Nadia Rahman");

    const stored = await db.query<{
      token: string;
      type: string;
      expiresAt: Date;
    }>('SELECT token, type, "expiresAt" FROM "VerificationToken" WHERE "userId" = $1', [
      user.rows[0]!.id,
    ]);
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]!.type).toBe("STAFF_INVITE");
    expect(stored.rows[0]!.token).toBe(sha256(token));
    expect(stored.rows[0]!.token).not.toBe(token);

    const ttl = await db.query<{ seconds: number }>(
      `SELECT extract(epoch FROM ("expiresAt" - (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))::int AS seconds
         FROM "VerificationToken"
        WHERE "userId" = $1`,
      [user.rows[0]!.id]
    );
    expect(ttl.rows[0]!.seconds).toBeGreaterThan(
      TOKEN_TTL.STAFF_INVITE / 1000 - 60
    );
    expect(ttl.rows[0]!.seconds).toBeLessThanOrEqual(TOKEN_TTL.STAFF_INVITE / 1000);
  });

  it("requires an owner or manager session", async () => {
    await request("/api/v1/staff/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "No One",
        email: uniqueEmail(),
        role: "WAITER",
      }),
      expect: 401,
    });
  });

  it("refuses an active account", async () => {
    const active = await createStaffUser({
      restaurantId: restaurant.restaurantId,
      role: "WAITER",
    });

    const { body } = await invite(
      owner,
      { fullName: "Already Here", email: active.email, role: "WAITER" },
      409
    );

    expect(body.message).toMatch(/active account/i);
  });

  it("refuses a disabled account and tells the manager to re-enable it", async () => {
    const disabled = await createStaffUser({
      restaurantId: restaurant.restaurantId,
      role: "WAITER",
      status: "DISABLED",
    });

    const { body } = await invite(
      owner,
      { fullName: "Disabled", email: disabled.email, role: "WAITER" },
      409
    );

    expect(body.message).toMatch(/re-enable/i);
  });
});

describe("verifying and accepting an invitation", () => {
  it("previews the invite without spending it", async () => {
    const email = uniqueEmail();
    await invite(owner, { fullName: "Preview Person", email, role: "CHEF" });
    const { token } = sentInvite();

    const first = await verify(token);
    const second = await verify(token);

    expect(first.body.data).toMatchObject({
      fullName: "Preview Person",
      email,
      role: "CHEF",
    });
    expect(first.response.headers.get("cache-control")).toBe("no-store");
    expect(second.body.data.email).toBe(email);
  });

  it("activates the account, issues a session and burns the link", async () => {
    const email = uniqueEmail();
    await invite(owner, { fullName: "Accept Person", email, role: "WAITER" });
    const { token } = sentInvite();

    const accepted = await accept(token, "brand-new-password");
    expect(accepted.body.data).toMatchObject({ email, status: "ACTIVE" });
    expect(readCookie(accepted.response, "accessToken")).toBeTruthy();

    const user = await db.query<{ password: string | null; status: string }>(
      'SELECT password, status FROM "User" WHERE email = $1',
      [email]
    );
    expect(user.rows[0]!.status).toBe("ACTIVE");
    expect(await compareValue("brand-new-password", user.rows[0]!.password!)).toBe(true);

    // The link is spent: the row is gone, so a replay reads as unknown.
    const replay = await accept(token, "another-password", 400);
    expect(replay.body.message).toMatch(/not valid/i);
    await verify(token, 400);

    const sessions = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "brand-new-password" }),
    });
    expect(sessions.body.data.email).toBe(email);
  });

  it("rejects a link that does not exist", async () => {
    await verify("this-token-was-never-issued", 400);
    await accept("this-token-was-never-issued", "brand-new-password", 400);
  });

  it("rejects an expired link", async () => {
    const email = uniqueEmail();
    const { body } = await invite(owner, {
      fullName: "Late Person",
      email,
      role: "WAITER",
    });
    const { token } = sentInvite();

    await db.query(
      `UPDATE "VerificationToken"
          SET "expiresAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '1 minute'
        WHERE "userId" = $1`,
      [body.data.id]
    );

    const expired = await verify(token, 400);
    expect(expired.body.message).toMatch(/expired/i);
    await accept(token, "brand-new-password", 400);
  });

  it("replaces the previous link when an invited user is re-invited", async () => {
    const email = uniqueEmail();
    await invite(owner, { fullName: "Reinvited", email, role: "WAITER" });
    const firstToken = sentInvite().token;

    await invite(owner, { fullName: "Reinvited", email, role: "CHEF" });
    const secondToken = sentInvite().token;

    expect(secondToken).not.toBe(firstToken);
    await verify(firstToken, 400);
    const current = await verify(secondToken);
    expect(current.body.data.role).toBe("CHEF");

    const user = await db.query<{ id: string }>('SELECT id FROM "User" WHERE email = $1', [
      email,
    ]);
    const tokens = await db.query(
      'SELECT id FROM "VerificationToken" WHERE "userId" = $1',
      [user.rows[0]!.id]
    );
    expect(tokens.rows).toHaveLength(1);
  });
});

describe("role hierarchy", () => {
  it("lets a manager invite ordinary staff", async () => {
    await invite(manager, {
      fullName: "Managed Waiter",
      email: uniqueEmail(),
      role: "WAITER",
    });
  });

  it("stops a manager from creating or touching another manager", async () => {
    const { body } = await invite(
      manager,
      { fullName: "Peer Manager", email: uniqueEmail(), role: "MANAGER" },
      403
    );

    expect(body.message).toMatch(/only the owner/i);
  });

  it("never allows the owner role to be granted through an invite", async () => {
    await invite(
      owner,
      { fullName: "Second Owner", email: uniqueEmail(), role: "OWNER" },
      400
    );
  });

  it("keeps waiters out of staff management", async () => {
    await invite(
      waiter,
      { fullName: "Nope", email: uniqueEmail(), role: "WAITER" },
      403
    );
  });

  it("lets the owner invite a manager", async () => {
    await invite(owner, {
      fullName: "Trusted Manager",
      email: uniqueEmail(),
      role: "MANAGER",
    });
  });
});

describe("failed delivery", () => {
  it("discards the new account so nothing is left marked invited", async () => {
    const email = uniqueEmail();
    mail.mockRejectedValueOnce(
      new AppError("Could not send the invitation email", 502)
    );

    const { body } = await invite(
      owner,
      { fullName: "No Mail", email, role: "WAITER" },
      502
    );
    expect(body.message).toBe("Could not send the invitation email");

    const user = await db.query('SELECT id FROM "User" WHERE email = $1', [email]);
    expect(user.rows).toHaveLength(0);
  });

  it("keeps the previous link alive when a re-invite cannot be delivered", async () => {
    const email = uniqueEmail();
    await invite(owner, { fullName: "Still Invited", email, role: "WAITER" });
    const { token } = sentInvite();

    mail.mockRejectedValueOnce(
      new AppError("Could not send the invitation email", 502)
    );
    await invite(owner, { fullName: "Still Invited", email, role: "CHEF" }, 502);

    const stillValid = await verify(token);
    expect(stillValid.body.data.email).toBe(email);
  });
});
