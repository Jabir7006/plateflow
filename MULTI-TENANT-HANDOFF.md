# PlateFlow — session handoff

**Branch:** `feat/public-surface-hardening` (created after `feat/multi-tenant-foundation` merged)
**Date:** 2026-11-07
**Status:** Foundation merged. Public-surface hardening implemented: rate limiting on the
anonymous/auth surface, Helmet security headers, configurable trust proxy, JSON body-size
limit, and an explicit 413 path. Unit and integration suites green.

> This file is a session handoff, not project documentation. Delete it once the branch is merged.

---

## 0. Resume here (for the next agent)

Read this section first. Everything below is background.

- **Tenancy foundation is complete and merged** (data model, auth tenant context, query isolation, frontend tenant label).
- **Public-surface hardening is implemented on this branch:**
  - `backend/src/middlewares/rate-limit.middleware.ts` — public read/write and auth limiters,
    env-driven, off outside production by default.
  - `backend/src/middlewares/security.middleware.ts` — Helmet; CSP/HSTS only in production,
    CORP cross-origin for the separate frontend origin.
  - `backend/src/config/env.ts` — `TRUST_PROXY`, `JSON_BODY_LIMIT`, `RATE_LIMIT_*` parsing.
  - `backend/src/app.ts` — configurable trust proxy, headers first, body limits, CORS.
  - `backend/src/middlewares/error.middleware.ts` — body-parser 413 mapped to the JSON error shape.
- **New coverage:** `backend/tests/unit/middlewares/rate-limit.test.ts` (factory on/off, 429 shape,
  headers) and `backend/tests/integration/public-surface-hardening.test.ts` (real headers, 413,
  public read/write 429). Unit suite **175 tests / 21 files**; integration **110 passed / 1 skipped**.
- **Deploy and recovery runbooks are written:**
  - `docs/DEPLOY-RUNBOOK.md` — Render + Vercel + Neon setup, env matrix, first launch, release,
    rollback, `TRUST_PROXY` verification, two-tenant staging E2E, monitoring.
  - `docs/BACKUP-RESTORE.md` — Neon PITR/branch drill, logical `pg_dump`/`pg_restore`, verification,
    evidence template, disaster recovery.
  - `docs/DRILL-LOG.md` — recorded drill evidence.
  - `backend/scripts/` adds `db:backup`, `db:restore`, and the read-only `db:verify-restore`.
  - **Logical restore drill passed (2026-11-07):** dumped the disposable test database, restored it
    into a scratch database on the same Neon endpoint with `pg_restore`, and verified it. All 10
    checks passed, all 10 table counts matched the source exactly, and the order spot-check matched
    (status, total, line items, restaurant). Restore took 17.3 s; RTO was under a minute.
  - **Neon branch/PITR drill passed (2026-11-09):** inserted marker rows in the disposable `test`
    branch, recorded a restore point, deleted them, and created a branch from that past point. The
    branch contained all marker rows, passed all 10 restore checks, and took 7.2 s to create +
    verify (19.2 s including a safety wait). The source branch was never overwritten. Evidence for
    both drills is in `docs/DRILL-LOG.md`.
- **Deploy blockers fixed:** backend `build` now runs `prisma generate && tsc` (generated client is
  gitignored), and the frontend production build requires `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` instead
  of silently using the local Cloudinary cloud.
- **`backend/.env.example` and `frontend/.env.example` document every variable, including
  hardening and the Cloudinary build-time name.**
- **Next recommended work, in order** (agreed with the user, who is building this as a real SaaS):
  1. **Run the staging two-tenant E2E** using `docs/DEPLOY-RUNBOOK.md` §7.1; the runbook itself is
     written, but the real deployment has not been exercised yet.
  2. **Business layer** (self-serve signup, plans/gating, billing, super-admin) — deliberately later.
  3. Payments remain deferred until after the pilot; no billing code belongs on this branch.

Commands to re-verify the current state:

```bash
cd backend
pnpm db:generate          # only needed if src/generated/prisma is stale/missing
pnpm test:unit            # 175 tests, 21 files (includes the tenant-scope guard and restore checks)
pnpm test:integration     # reads TEST_DATABASE_URL from backend/.env; ~121s
cd ..
pnpm --filter frontend lint
pnpm --filter frontend typecheck
pnpm --filter frontend build
```

Ask before committing/pushing. Repo convention: `git commit -F <file>` (heredocs drop the last line);
**no `Co-Authored-By` trailer**.

## 1. The goal

PlateFlow was single-tenant: one deployment = one restaurant, every query global.
This branch turns it into a **multi-tenant SaaS** — many restaurants in one
deployment + one database, strictly isolated by `restaurantId`, so it can be sold
as a subscription to any restaurant.

This phase is the **tenancy foundation only**. Explicitly **out of scope** (later
phases): self-serve signup, subscription plans/gating, billing (Paddle/Lemon
Squeezy), super-admin panel, per-restaurant food-payment providers
(SSLCommerz/Stripe), diner-page branding, staff-at-multiple-restaurants.

Locked decisions:
- **Onboarding = admin-provisioned** (a CLI script creates each restaurant + its first OWNER).
- **`User.email` stays globally unique** — one person = one account at one restaurant (v1).
- **`Table.qrCode`, token hashes stay globally unique** — `qrCode` is the only public tenant anchor.

The full plan lives at `~/.claude/plans/fizzy-rolling-hejlsberg.md`.

## 2. The three commits (+ uncommitted Part 4)

| Commit | What |
| --- | --- |
| `dbe59ef` | `feat(backend): multi-tenant restaurant foundation` — schema, migration, seed, provisioning CLI, test scaffolding |
| `5362e8e` | `feat(backend): enforce tenant isolation across every query` — the scoping itself, middleware, realtime rooms, contract migration, frontend cache fix |
| `2688f4a` | `test(backend): cover critical paths with unit and integration suites` |
| *(uncommitted)* | Part 4 — sidebar shows the active restaurant name, plus this handoff update |
| *(uncommitted)* | Tenant-scope regression guard — static AST check in the unit suite, with a documented allowlist for intentional global reads |
| *(uncommitted)* | Real-user journey + image/upload tests — one end-to-end API/socket day, plus Cloudinary/Multer coverage |

## 3. Architecture — the parts a next agent must NOT casually change

### 3.1 Tenant anchors: where `restaurantId` comes from

Two sources, and only two. The client **never** sends a tenant id.

- **Staff** → the **signed access JWT**. `restaurantId` is baked into
  `accessTokenPayload` at `issueTokens` (`src/modules/auth/auth.service.ts`) and
  read on every request. Server-derived, unforgeable.
- **Diner** (public, no auth) → the **`Table.qrCode`** in the URL path. It
  resolves to exactly one table, hence one restaurant. This is why `qrCode` is
  globally unique.

### 3.2 Scoping mechanism — explicit threading (deliberate, do not "improve")

`restaurantId` is threaded **explicitly as a required first argument** into every
service function, and added to every `where` / `create`. Patterns:

- by-id **read** → `findFirst({ where: { id, restaurantId } })`
- by-id **write** → `updateMany` / `deleteMany({ where: { id, restaurantId } })` + `count === 0` check
- list/stat queries → `where: { restaurantId, ... }`

**Why explicit and not Prisma `$extends` / AsyncLocalStorage:** it is fully
reviewable — you can read any service function and see the scope. The codebase
already had this explicit style. A magic auto-scoping layer was considered and
rejected on purpose; do not reintroduce it without discussing.

### 3.3 Fail-closed guards

- `src/middlewares/tenant.middleware.ts` → `tenantContext` runs after
  `authenticate`, stamps `req.restaurantId` from `req.user`, and 401s if absent.
  `requireTenant(req)` is the non-null accessor used by controllers — it throws
  rather than silently defaulting.
- `authenticate` (`src/modules/auth/auth.middleware.ts`) **rejects a token with no
  `restaurantId`** — so a pre-tenant token can't reach a scoped service. This
  forces a re-login on deploy, which is intended.
- `tenantContext` is mounted on every staff router (tables, menu categories,
  menu items, staff, staff orders, realtime ticket).

### 3.4 Public surface changed: the menu is no longer public

**`GET /menu/items` and `GET /menu/categories` were public; they are now staff-only**
(any authenticated role). Reason: an unscoped public list would leak every
restaurant's menu once several share a database.

The diner still reads a menu — through `GET /api/v1/t/:token`, which resolves the
tenant from the QR token (`diner.service.ts` → `menuItemService.list(restaurantId, { availableOnly: true })`).

If any future client calls `/menu/items` anonymously, it will now get 401. This
was intentional; the frontend `/menu` page already sits under `app/(protected)/`.

### 3.5 Realtime

- Global `STAFF_ROOM` → **`staffRoom(restaurantId)`** (`staff:<restaurantId>`).
- WS ticket payload gained `restaurantId`; the ticket is signed with a key
  **derived** from `ACCESS_TOKEN_SECRET` via HMAC (domain separation, so a ticket
  can't be verified as an access token or vice versa).
- `emitOrderNew(restaurantId, …)` / `emitOrderUpdated(restaurantId, …)` target the
  order's own restaurant room. `order:<orderId>` rooms are unchanged.
- Diner sockets only join their own order room, after the DB re-checks that the
  order belongs to the token's table.

### 3.6 Frontend

- `AuthUser.restaurant: { id, name }` added to `@plateflow/shared`; returned by
  `/auth/login` and `/auth/me`.
- `use-set-session.ts` (new): login + invite-acceptance now go through it, which
  **clears the react-query cache** before adopting the new identity. Without this,
  signing in as restaurant B on a tab that had A's session would show A's cached
  orders/tables/menu for up to the 60s `staleTime`. Boot-time session restore
  deliberately skips it (cache is empty on a fresh load).
- `features/menu/api.ts` comments updated (they no longer describe a public read).
- **Part 4 (uncommitted):** `features/dashboard/components/sidebar-user.tsx` now
  shows the **restaurant name** as the primary sidebar-footer label, with
  `fullName · role` on the second line; the collapsed-rail tooltip includes the
  restaurant too. Intent: the active tenant is always visible next to the signed-in
  identity, because one person can hold accounts at different restaurants.

## 4. Data model & migrations

`Restaurant` is the tenant root. `restaurantId` FK (+ `@@index`) on **User,
MenuItem, MenuCategory, Table, Order**. `OrderItem`, `MenuItemSize`,
`VerificationToken`, `RefreshToken` inherit tenancy through their parent — no
column added.

Composite uniques replaced the global ones:
- `@@unique([restaurantId, number])` on Table (was `number @unique`)
- `@@unique([restaurantId, name])` on MenuCategory (was `name @unique`)

Order reporting indexes became `[restaurantId, createdAt]` and
`[restaurantId, status, createdAt]`.

**Two migrations, deliberately sequenced (expand/contract):**

1. `20261011190933_multi_tenant_foundation` — create `Restaurant`, insert
   `default_restaurant`, add `restaurantId` **nullable**, backfill every existing
   row to the default, swap indexes/uniques, add FKs.
2. `20261024070000_tenant_restaurant_id_required` — the **contract**: a `DO $$`
   block that (a) returns early if there are no orphans, (b) **raises** with an
   actionable message if orphans exist *and* >1 restaurant exists (ambiguous
   owner — refuses to guess), (c) folds orphans into the sole restaurant if there
   is exactly one, then `SET NOT NULL` on all five tables.

**Why split:** making `restaurantId` required in Part 1 would have broken every
`.create()` (no tenant context existed yet) and left the app non-compiling. The
split let Part 1 land with **zero service changes**. The contract migration then
landed with Part 3, once every writer supplied the value.

## 5. Verified ✅ (re-run these to confirm)

| Check | Result |
| --- | --- |
| `prisma validate` | valid |
| `prisma generate` | ok |
| `pnpm --filter backend typecheck` | clean |
| `pnpm --filter backend lint` | clean |
| `pnpm --filter backend test:unit` | **175 tests, 21 files, all pass** (tenant-scope guard, rate limiter, restore helpers, graceful shutdown) |
| `pnpm --filter backend test:integration` | **9 files, 110 passed, 1 skipped (111)** — executed 2026-11-07, ~121s |
| `pnpm --filter frontend lint` / `typecheck` | clean (re-run after Part 4) |
| `pnpm --filter frontend build` | ok (11 routes, Next 16.2.6 / Turbopack) |
| `prisma migrate status` (dev DB) | up to date, 8 migrations |
| `prisma migrate status` (test DB) | up to date, 8 migrations |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | **No difference** (no drift, dev DB) |
| DB row audit (dev) | 1 restaurant (`default_restaurant`); `restaurantId` **NOT NULL** on all 5 tables; **0 orphan rows** (User 2/2, MenuItem 9/9, MenuCategory 5/5, Table 6/6, Order 10/10) |
| Dev DB after integration run | unchanged (User 2, MenuItem 9, MenuCategory 5, Table 6, Order 10, OrderItem 14) |
| Test DB after integration run | returned to baseline (1 `default_restaurant`, 0 users/menu/tables/orders) — cleanup works |
| Local browser walkthrough (2026-11-05) | login → sidebar shows restaurant → menu → QR diner order → live board PENDING→PREPARING→READY→SERVED → diner status updates over sockets → history/stats show the order → second tenant sees an empty history and a cold cache. Test DB returned to baseline afterwards. |

### 5.1 Integration suite details (do not lose this)

The suite is now real, proven, and safe to re-run:

- `backend/.env` has `TEST_DATABASE_URL` → a **separate disposable Neon database**.
  It is *not* the dev DB: different host and database path were checked explicitly.
- `tests/setup.integration.ts` imports `dotenv/config`, reads `TEST_DATABASE_URL`,
  then **overrides** `DATABASE_URL` and `DIRECT_URL` from it. So plain
  `pnpm --filter backend test:integration` from the repo root works; no exports needed.
- The suite is now 7 files. `real-user-journey.test.ts` drives one restaurant's whole
  day through the public API and real sockets, so the features are also proven together,
  not only in their focused files.
- **1 skipped test** is the `default restaurant regression` in
  `tenant-isolation.test.ts` (§408). It requires a seeded `default_restaurant`
  with an OWNER and tables. The disposable DB has only the bare restaurant row, so
  it self-skips — this is the documented, correct behavior, not a failure.
  `SEED_MANAGER_PASSWORD` *is* present in `backend/.env`; the skip happens because
  the **data** is absent, not the variable.
- The suite provisions each restaurant through the real
  `prisma/create-restaurant.ts` CLI and deletes exactly what it created. A run
  leaves the disposable DB at its baseline and never touches the dev DB.
- Re-running does not require re-migrating (test DB is already at 8 migrations).
  If you ever point it at a *new* empty DB, apply migrations first with
  `DATABASE_URL`/`DIRECT_URL` set to that DB (`prisma migrate deploy`; never `migrate dev`).

## 6. Remaining verification ⚠️

The DB/API/socket guarantee is proven by the integration suite, including the
`real-user-journey.test.ts` file that runs one restaurant's whole day through the public API and
real sockets. A **local browser walkthrough** on 2026-11-05 also passed the human path against the
disposable test DB (login, sidebar tenant label, menu, QR order, live status, history/stats, and a
second tenant's empty view). What is **still not verified**:

- **Staging deploy + two real restaurants from separate devices:** the local walkthrough used one
  browser, so cross-device socket separation and cookie behavior on a real deployment are still
  worth a staging pass. The staging E2E checklist is in `docs/DEPLOY-RUNBOOK.md` §7.1.
- **Deploy runbook:** written in `docs/DEPLOY-RUNBOOK.md`. It covers Render/Vercel/Neon setup, the
  production env matrix, `TRUST_PROXY`, first launch, release, and rollback. The contract migration
  must be applied with `prisma migrate deploy`; all pre-tenant staff sessions become invalid and
  every user must log in again. Prepare the support note.
- **Backup/restore drill:** the strategy, scripts, and verification are in
  `docs/BACKUP-RESTORE.md`. Both drills passed: the logical `pg_dump` → `pg_restore` round trip
  (2026-11-07) and the Neon branch-from-past/PITR drill (2026-11-09). Evidence is in
  `docs/DRILL-LOG.md`. Production must use a 7-day history window; the disposable test project is
  currently on the 6-hour Free-plan cap.

Two **pre-existing UI gaps** surfaced during the walkthrough (not tenant-foundation defects, and not
introduced by this branch): the dashboard cards still read hard-coded mock data
(`frontend/features/dashboard/data.ts`) even though the real stats API exists, and the sidebar
"Staff" link targets `/staff`, which has no page (404). The order board, history, and stats screen
are real and tenant-scoped.

## 7. Remaining work (prioritized for a real SaaS)

**Done on this branch:**
- Public-surface hardening — limiters, Helmet, trust proxy, body limits, 413 mapping, env examples.
  Unit suite green at 175 tests / 21 files; integration green at 111 tests (1 intentional skip) / 9 files.
- Deploy runbook and backup/restore drill tooling — `docs/DEPLOY-RUNBOOK.md`,
  `docs/BACKUP-RESTORE.md`, `docs/DRILL-LOG.md`, `backend/scripts/db-{backup,restore}.ts`, and
  `backend/scripts/verify-restore.ts` with unit + integration coverage. Both the logical restore
  and Neon branch/PITR drills passed (2026-11-07 and 2026-11-09).
- Deploy build fixes — `prisma generate` in the backend build, and a required
  `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` for production frontend builds.
  Frontend lint/typecheck unaffected.
- Graceful shutdown — `SIGTERM`/`SIGINT` now close socket.io, the HTTP server,
  Prisma, and the pg pool, with a 10 s force-exit watchdog. Unit-tested and
  smoke-tested against the built server (`/health` then `SIGTERM` → exit 0).

### 7.1 Tenant-scope guard — what it checks and how to extend it

Implemented as a unit test (`backend/tests/unit/tenant-scope.test.ts`) backed by
`backend/tests/unit/lib/tenant-scope.ts`. It parses `src/**/*.ts` with the
TypeScript compiler API (no new dependency, no DB), so `pnpm test:unit` fails on:

- a Prisma read/write on `User`, `MenuItem`, `MenuCategory`, `Table`, `Order`
  whose `where` does not prove the tenant;
- a `create`/`createMany` whose `data` omits `restaurantId` (or the `restaurant`
  relation);
- a standalone `OrderItem`/`MenuItemSize` query that does not prove its parent order's
  tenant, or a create that omits the parent FK;
- an `update` whose `data` sets `restaurantId` / the `restaurant` relation (or re-parents a
  child via `orderId`/`menuItemId`), which would move a row between tenants;
- an unscoped `restaurantId` hidden in `NOT` or a partly-scoped `OR`;
- `restaurantId: undefined` (Prisma drops undefined keys — an orphan trap);
- raw `$queryRaw` / `$executeRaw`, an unclassified Prisma model, or an unknown
  delegate method (fails closed, forcing review);
- a stale or duplicate allowlist entry.

What counts as proof: a positive `restaurantId`; an `AND` with at least one
scoped conjunct; an `OR` whose every branch is scoped; the `table.qrCode` diner
anchor; or `restaurant.id` / `table.restaurantId`. It follows local `where`
variables, type wrappers, spreads, and `$transaction` client parameters.

Intentional global reads live in the `DEFAULT_ALLOWLIST` with a required
`reason` and a pinned call shape (file + function + model + method + `where`
keys). Current entries: login by email, session restore by token id, invite
acceptance, and the cross-tenant invite check. **Never add an entry to silence a
missing filter** — only for reads that are global by design.

**Next, recommended order:**

1. **Two-tenant staging E2E + deploy runbook** (§6).
2. **Business layer:** self-serve signup/trial, plan gating, billing, super-admin.

### 7.3 Public-surface hardening — what exists now

- **Rate limiting** (`rate-limit.middleware.ts`) is env-driven and defaults to on in production,
  off in development/test. Public reads (diner menu, order status) and public writes (place order)
  are limited; auth/invite endpoints use a longer window and do not count successful requests.
- **`RATE_LIMIT_ENABLED=true`** is required to exercise limits locally. `RATE_LIMIT_*` variables
  control windows and maxima; tests set them before importing the app.
- **Store is in-memory per process.** Scaling horizontally needs a shared store (e.g. Redis) or each
  instance enforces its own quota. This is deliberate for the pilot.
- **`TRUST_PROXY`** defaults to `1` (the Next rewrite). Production must match the real proxy chain,
  or `req.ip` will be the proxy and every client will share one bucket. Verify `X-Forwarded-For`
  in staging.
- **Security headers** (`security.middleware.ts`) run first, so 4xx/413/429 responses carry them.
  CSP and HSTS are production-only; CORP is cross-origin for the separate frontend origin.
- **Body limit** is `JSON_BODY_LIMIT` (default `1mb`); oversized bodies map to a JSON 413 in
  `error.middleware.ts`. Multipart uploads keep Multer's separate 5MB limit.

## 8. Gotchas for the next agent

- **`backend/src/generated/prisma/` is gitignored.** After pulling this branch you
  MUST run `pnpm --filter backend db:generate`, or typecheck fails with bogus
  `'user.restaurant' is possibly 'null'` / `string | null` errors. That is a stale
  local artifact, not a code bug.
- **`prisma/`, `tests/` are outside the default `tsconfig.json`** (`include: ["src/**/*"]`).
  A full check is `pnpm typecheck`, which uses `tsconfig.all.json` (adds
  `prisma/**/*.ts`, `tests/**/*.ts`, `vitest.*.ts`, `rootDir: "."`).
- **`prisma migrate diff` in Prisma 7 uses `--from-config-datasource` / `--to-schema`,**
  not the older `--from-url` / `--to-schema-datamodel`. The old flags error out.
- **Never use `prisma migrate dev` here** — it can offer a **destructive reset** if
  it detects drift. Use `migrate deploy`. Drift is currently zero.
- **Only DB reachable is remote Neon.** No local Postgres, no Docker/Podman.
  Dev and test are two separate Neon databases; `.env` holds both.
- **`backend/.verify/` is gitignored** — scratch dir for throwaway DB-check scripts.
  It now contains `inspect-test-db.cjs` (read-only test-DB inspection). Put ad-hoc
  scripts there, not in the repo. `tsx`/`node` must run them from inside `backend/`.
- **Email normalization:** `seed.ts` and `create-restaurant.ts` both `.trim().toLowerCase()`
  the email. `seed.ts` additionally throws if the seeded owner email already belongs
  to a different restaurant. Keep normalizing on any new user-write path — the
  cross-tenant invite guard in `staff.service.ts` depends on it.
- **Rate limiting is off in dev/test by default.** Set `RATE_LIMIT_ENABLED=true` to exercise it.
  Integration tests that need 429s must override the `RATE_LIMIT_*` variables *before* importing
  `src/app.ts` (see `tests/integration/public-surface-hardening.test.ts`).
- **`TRUST_PROXY` must match the production proxy chain.** A wrong value buckets every client behind
  the proxy IP and makes the limits useless. Check `X-Forwarded-For` in staging.
- **`OrderItem`/`MenuItemSize` have no `restaurantId`** — always reach them through
  the parent, never standalone.
- **The test suite is stateful about fixtures but not the DB:** it creates random
  slugs/emails per run and cleans them. If a run is interrupted, orphan
  `test-*` rows can remain; they are safe to delete by slug (`test-*`) but do not
  blanket-delete `default_restaurant`.
- Repo conventions: `git commit -F <file>` (heredocs drop the last line); **no
  `Co-Authored-By` trailer**; ask before committing/pushing.

## 9. Things worth a second opinion

1. ~~Run the integration suite~~ — **done 2026-11-05**, 103 passed / 1 legitimate skip.
2. `staff.service.ts` invite: an existing user from *another* restaurant now gets a
   generic 409 "This email is already in use" (deliberately non-disclosing). Confirm
   that UX is acceptable.
3. `authenticate` rejecting pre-tenant tokens = **every existing staff session is
   invalidated on deploy** and must log in again. Intended, but worth a conscious ok.
4. `menuItemService.update` replaces sizes as a set (`deleteMany: {}` then create).
   The comment says it's safe "while orders don't reference sizes yet" — revisit if
   `OrderItem` ever gains a `sizeId` FK.
5. ~~No automated guard that a NEW service method gets scoped~~ — **addressed**
   2026-11-05 by the tenant-scope guard (§7.1). Its known limit: a `where`
   assembled dynamically (from a function argument, not a local const) cannot be
   proven statically, so the guard **fails closed** rather than guessing. If a
   legitimate future query is dynamic, resolve it into a local const with
   `restaurantId` or add a reviewed allowlist entry with a `reason`.
6. ~~Public endpoints are unthrottled and there is no helmet/body-size limit~~ — **addressed**
   2026-11-07 on `feat/public-surface-hardening`; see §7.3. Remaining decision: when to move the
   rate-limit store to Redis (only needed once the API runs more than one instance).
