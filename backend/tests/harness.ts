import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { io as connect, type Socket } from "socket.io-client";
import { hashValue } from "../src/utils/bcrypt.js";
import { randomId, sha256 } from "../src/utils/crypto.js";
import type { Role, UserStatus } from "../src/generated/prisma/enums.js";

// Shared harness for the integration suites: real app, real database, real
// sockets — only the data is disposable. Everything created here is tracked so
// teardown can remove it exactly, leaving the dev database as it found it.

export const BACKEND_ROOT = fileURLToPath(new URL("..", import.meta.url));

export const db = new Client({
  connectionString: process.env.DIRECT_URL,
  connectionTimeoutMillis: 15_000,
  statement_timeout: 30_000,
});

export const suffix = () => randomBytes(6).toString("hex");

export interface Provisioned {
  restaurantId: string;
  ownerId: string;
  email: string;
  password: string;
  slug: string;
}

// Every fixture is recorded here the moment its identifying values exist — before
// the CLI runs — so a provisioning that fails *after* writing rows can still be
// cleaned up. Cleanup resolves by slug or owner email rather than relying on ids
// that a failed run never returned.
const fixtures: { slug: string; email: string }[] = [];

// Runs the real admin-provisioning CLI, so the suite exercises the same path an
// operator uses rather than inserting rows behind its back.
export async function provisionRestaurant(
  name: string
): Promise<Provisioned & { output: string }> {
  const tag = suffix();
  const slug = `test-${tag}`;
  const email = `test-${tag}@example.com`;
  const password = randomBytes(24).toString("base64url");
  fixtures.push({ slug, email });

  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "prisma/create-restaurant.ts",
      "--name",
      name,
      "--slug",
      slug,
      "--owner-name",
      `Owner ${tag}`,
      "--owner-email",
      email,
    ],
    {
      cwd: BACKEND_ROOT,
      env: { ...process.env, PLATEFLOW_OWNER_PASSWORD: password },
      encoding: "utf8",
      timeout: 60_000,
    }
  );

  if (result.error || result.status !== 0) {
    throw new Error(
      `Provisioning failed: ${result.error?.message ?? result.stdout + result.stderr}`
    );
  }

  const { rows } = await db.query<{
    id: string;
    restaurantId: string;
  }>('SELECT id, "restaurantId" FROM "User" WHERE email = $1', [email]);
  const owner = rows[0];
  if (!owner) throw new Error(`Provisioned owner ${email} not found`);

  return {
    restaurantId: owner.restaurantId,
    ownerId: owner.id,
    email,
    password,
    slug,
    output: result.stdout + result.stderr,
  };
}

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

// Boots the real Express app plus the socket.io server on an ephemeral port.
export async function startServer(): Promise<TestServer> {
  const { default: app } = await import("../src/app.js");
  const { initRealtime } = await import("../src/realtime/realtime.js");

  const httpServer: Server = createServer(app);
  const io = initRealtime(httpServer);

  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const { port } = httpServer.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      // socket.io owns the http server once attached: closing it closes both.
      await new Promise<void>((resolve) => io.close(() => resolve()));
      if (httpServer.listening) {
        await new Promise<void>((resolve, reject) =>
          httpServer.close((error) => (error ? reject(error) : resolve()))
        );
      }
    },
  };
}

export interface Session {
  headers: Record<string, string>;
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    restaurant: { id: string; name: string };
    role: string;
  };
}

export function api(baseUrl: string) {
  return async function request(
    path: string,
    options: RequestInit & { expect?: number } = {}
  ) {
    const { expect = 200, ...init } = options;
    const response = await fetch(baseUrl + path, {
      ...init,
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json().catch(() => null);

    if (response.status !== expect) {
      throw new Error(
        `${init.method ?? "GET"} ${path} expected ${expect}, got ${response.status}: ${body?.message ?? ""}`
      );
    }

    return { response, body };
  };
}

// Every refresh token this suite logs in with, tracked by the digest the
// database stores. Teardown deletes exactly these rows, so a test that signs
// into the seeded owner cannot strand a session and nothing unrelated is ever
// in scope.
const issuedRefreshTokenHashes: string[] = [];

export function removeIssuedRefreshTokens() {
  if (issuedRefreshTokenHashes.length === 0) return Promise.resolve();

  return db
    .query('DELETE FROM "RefreshToken" WHERE "tokenHash" = ANY($1::text[])', [
      issuedRefreshTokenHashes,
    ])
    .then(() => undefined);
}

// The response sets the same cookie name on several paths — one live, the rest
// cleared — so the live value is the last non-empty one.
export function readCookie(response: Response, name: string): string | undefined {
  const values = response.headers
    .getSetCookie()
    .filter((header) => header.startsWith(`${name}=`))
    .map((header) => header.slice(name.length + 1).split(";")[0])
    .filter((value) => value.length > 0);

  return values.at(-1);
}

export async function login(
  request: ReturnType<typeof api>,
  email: string,
  password: string
): Promise<Session> {
  const { response, body } = await request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const accessToken = readCookie(response, "accessToken");
  if (!accessToken) throw new Error(`Login for ${email} returned no access cookie`);

  const refreshToken = readCookie(response, "refreshToken");
  if (refreshToken) issuedRefreshTokenHashes.push(sha256(refreshToken));

  return {
    headers: {
      Cookie: `accessToken=${accessToken}`,
      "Content-Type": "application/json",
    },
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    user: body.data,
  };
}

export interface StaffFixture {
  id: string;
  email: string;
  password: string;
  role: Role;
  status: UserStatus;
}

// A ready-to-log-in staff member. Fixtures are inserted directly because the
// invite endpoint's whole job is to send mail; role-guard tests should not have
// to exercise (or mock) that path to get a chef. Cleanup is covered by
// `removeRestaurants`, which removes every user in the fixture's restaurant.
export async function createStaffUser({
  restaurantId,
  role = "WAITER",
  status = "ACTIVE",
  fullName = "Test Staff",
  email,
  password,
}: {
  restaurantId: string;
  role?: Role;
  status?: UserStatus;
  fullName?: string;
  email?: string;
  password?: string;
}): Promise<StaffFixture> {
  const tag = suffix();
  const resolvedEmail = email ?? `staff-${tag}@example.com`;
  const resolvedPassword = password ?? randomBytes(24).toString("base64url");
  const id = randomId(12);

  await db.query(
    `INSERT INTO "User"
       (id, "fullName", email, password, role, status, "restaurantId")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      fullName,
      resolvedEmail,
      await hashValue(resolvedPassword),
      role,
      status,
      restaurantId,
    ]
  );

  return {
    id,
    email: resolvedEmail,
    password: resolvedPassword,
    role,
    status,
  };
}

// Socket fixtures are collected per module so teardown cannot miss one. A test
// that expects a rejected handshake uses `waitForConnectError`, which does not
// throw; the generic waitForConnect does.
const sockets: Socket[] = [];

export function newSocket(
  baseUrl: string,
  auth: Record<string, unknown>
): Socket {
  const socket = connect(baseUrl, {
    auth,
    transports: ["websocket"],
    reconnection: false,
  });
  sockets.push(socket);
  return socket;
}

export function waitForConnect(socket: Socket, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("socket connect timeout")),
      timeoutMs
    );
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(new Error(`socket connect_error: ${String(error)}`));
    });
  });
}

export function waitForConnectError(socket: Socket, timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("socket was not rejected within the timeout")),
      timeoutMs
    );
    socket.once("connect_error", (error: Error) => {
      clearTimeout(timer);
      resolve(error.message);
    });
    socket.once("connect", () => {
      clearTimeout(timer);
      reject(new Error("socket connected but the handshake should have failed"));
    });
  });
}

export function disconnectSockets(): void {
  for (const socket of sockets) socket.disconnect();
  sockets.length = 0;
}

// Removes everything a test created, in FK order. Deliberately scoped by the
// restaurant ids the test owns, so a failure can never delete real data.
export async function removeRestaurants(restaurantIds: string[]) {
  if (restaurantIds.length === 0) return;

  await db.query("BEGIN");
  try {
    await db.query(
      'DELETE FROM "Order" WHERE "restaurantId" = ANY($1::text[])',
      [restaurantIds]
    );
    await db.query(
      'DELETE FROM "MenuItem" WHERE "restaurantId" = ANY($1::text[])',
      [restaurantIds]
    );
    await db.query(
      'DELETE FROM "MenuCategory" WHERE "restaurantId" = ANY($1::text[])',
      [restaurantIds]
    );
    await db.query(
      'DELETE FROM "Table" WHERE "restaurantId" = ANY($1::text[])',
      [restaurantIds]
    );
    await db.query(
      'DELETE FROM "User" WHERE "restaurantId" = ANY($1::text[])',
      [restaurantIds]
    );
    await db.query('DELETE FROM "Restaurant" WHERE id = ANY($1::text[])', [
      restaurantIds,
    ]);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

// Every fixture, found by the slug and owner email recorded before provisioning
// started. A run that failed partway has no ids to hand back, so teardown
// resolves them instead of relying on what the test managed to collect.
export async function removeFixtures() {
  if (fixtures.length === 0) return;

  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM "Restaurant" WHERE slug = ANY($1::text[])
     UNION
     SELECT "restaurantId" AS id FROM "User" WHERE email = ANY($2::text[])`,
    [fixtures.map((fixture) => fixture.slug), fixtures.map((fixture) => fixture.email)]
  );

  await removeRestaurants(rows.map((row) => row.id));
}
