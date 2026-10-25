# Backend tests

Two suites, split because they have different requirements.

| Suite | Command | Needs |
| --- | --- | --- |
| Unit | `pnpm --filter backend test:unit` | Nothing — no `.env`, no database |
| Integration | `pnpm --filter backend test:integration` | `TEST_DATABASE_URL` pointing at a disposable Postgres database |
| Both | `pnpm --filter backend test` | Same as integration |

From the repo root, the same commands are available as `pnpm test`,
`pnpm test:unit`, and `pnpm test:integration`.

## Unit suite (`tests/unit`)

Pure logic and middleware, run in-process with no network. It covers the parts
where a regression is silent or security-relevant:

- JWT signing/verification, refresh-token payload shape, expiry and signature checks
- Websocket ticket signing and its separation from session tokens
- Hashing and random-id helpers
- Cookie flags (httpOnly, sameSite, path, max-age) and legacy-cookie eviction
- `authenticate`, `requireRole`, `tenantContext`, `requireTenant`, `validate`
- Error mapping (AppError, Zod, JWT, malformed JSON, unknown errors)
- Shared request schemas: auth, menu/prices/sizes, tables, orders/history ranges
- Staff-invite email escaping and copy

`tests/setup.unit.ts` pins `NODE_ENV=test` and supplies dummy values for every
environment variable a module reads at import time, so the suite runs anywhere.

## Integration suite (`tests/integration`)

Boots the real Express app, the real socket.io server, and a real Postgres
database. Each file provisions its own restaurants through the same CLI an
operator uses (`prisma/create-restaurant.ts`), creates data through the public
API, and deletes exactly what it created.

- `auth-flow.test.ts` — login, cookie flags, `/me`, rotation and replay detection,
  logout, disabled accounts
- `tenant-isolation.test.ts` — the cross-tenant guarantee: lists, by-id writes,
  staff invites, diner paths, orders, stats, realtime rooms
- `menu-management.test.ts` — categories/items/sizes/prices, validation,
  delete guards, availability, table CRUD and QR rotation
- `order-lifecycle.test.ts` — server-computed totals, menu staleness, the
  forward-only status machine, board ordering, history paging/filters, stats
- `staff-invite.test.ts` — invite creation, hashed tokens, verify/accept,
  single-use links, role hierarchy, rollback when mail fails
- `realtime.test.ts` — ticket claims, handshake rejection, staff fan-out,
  diner order ownership

Mail is mocked in the invite suite. Everything else hits the real database and
HTTP server.

## Running against a disposable database

The suite deliberately refuses to fall back to `DATABASE_URL`: it creates and
deletes restaurants, so the target must be an explicit, disposable database
(a Neon branch, a local Postgres database, an ephemeral CI service, …).

```powershell
# PowerShell — point both at the disposable database before migrating.
$env:DATABASE_URL   = "postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require"
$env:DIRECT_URL      = $env:DATABASE_URL
$env:TEST_DATABASE_URL = $env:DATABASE_URL

pnpm --filter backend exec prisma migrate deploy
pnpm --filter backend test:integration
```

```bash
# bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require"
export DIRECT_URL="$DATABASE_URL"
export TEST_DATABASE_URL="$DATABASE_URL"

pnpm --filter backend exec prisma migrate deploy
pnpm --filter backend test:integration
```

`TEST_DATABASE_URL` is a deliberate designation, not a hostname check: a Neon
development branch and production look identical from the client.

## Cleanup and safety

- Fixtures are recorded by restaurant slug and owner email before provisioning
  starts, so teardown still works when a run fails halfway through.
- Cleanup is scoped by the restaurant ids the run owns; it never issues an
  unscoped `DELETE`.
- Refresh tokens issued by test logins are tracked by digest and removed.
- `SEED_MANAGER_PASSWORD` is optional. The one seeded-restaurant regression in
  `tenant-isolation.test.ts` skips itself when it is absent.
- Error logs are silenced by default. Set `DEBUG_TESTS=1` to see the server's
  `console.error` output while debugging a failure.
