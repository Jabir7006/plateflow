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
- Image storage (`lib/image-storage.test.ts`) — Cloudinary mocked: upload success/failure,
  best-effort delete, replace ordering and rollback
- Upload middleware (`middlewares/upload.test.ts`) — real multipart requests through Multer:
  accepted MIME types, wrong MIME/field, the 5MB limit, missing file, returned bytes
- **Tenant-scope guard** — a static AST check that every Prisma call on a
  tenant-owned model (`User`, `MenuItem`, `MenuCategory`, `Table`, `Order`)
  proves its `restaurantId` in `where`/`data`. It also follows local `where`
  variables, `AND`/`OR` nesting, the `table.qrCode` diner anchor, `$transaction`
  client aliases, and fails closed on raw SQL or unknown models/methods. Child
  models (`OrderItem`, `MenuItemSize`) must prove their parent's tenant, and an
  update may not re-parent a row.

`tests/setup.unit.ts` pins `NODE_ENV=test` and supplies dummy values for every
environment variable a module reads at import time, so the suite runs anywhere.

### Tenant-scope guard

`tests/unit/lib/tenant-scope.ts` holds the analyzer and a small allowlist of
**intentionally global** reads (login by email, session restore by token id,
invite acceptance, the cross-tenant invite check). Each entry carries a
`reason` and a pinned call shape (file + function + model + method + `where`
keys), so a new or reshaped query cannot silently inherit the exception. An
entry that stops matching fails the suite as stale. Use the allowlist only when
a read is genuinely global by design — never to silence a missing tenant filter.

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
- `real-user-journey.test.ts` — one restaurant's whole day through the public API
  and real sockets: login, menu/table setup, QR menu, order + live status,
  board/history/stats, waiter invite/acceptance, and a second tenant's isolation

Mail is mocked in the invite and journey suites. Image hosting is mocked in the
unit image tests. Everything else hits the real database and HTTP server.

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
