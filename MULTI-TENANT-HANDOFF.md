# PlateFlow — standing handoff (resume here)

**Repo:** `/home/jabir/Projects/plateflow` — default branch `master`
**Updated:** 2026-11-26 · required CI on master; next implementation plan saved
**Live staging:** API `https://plateflow-staging-api.onrender.com` · web
`https://plateflow-nu.vercel.app` · Neon branch `staging`

> This is the durable resume point, not a throwaway session note. `AGENTS.md`
> at the repo root tells every AI to read this section first and to keep it
> current. Keep it short: status, done, next, rules, commands.

---

## 0. Resume here

**Status — GitHub requires a PR and passing CI on master.**
`AGENTS.md` now requires a written implementation plan for each task. The
staging release preflight plan is ready for a separate implementation session.
User approved activation. GitHub ruleset `28139606` is active:
https://github.com/Jabir7006/plateflow/rules/28139606.
Read-back of both the ruleset and effective master rules confirmed that it
targets only `refs/heads/master`, requires a PR and a passing `CI` from GitHub
Actions (app 15368), and requires the PR branch to be up to date with master.
There are zero required approving reviews or bypass actors, and merge, squash,
and rebase are all permitted. Verification used the GitHub API read-back.
Remote master is fe4ed73463927d4dd3e4434ed6956982700968d4. Its latest push run
completed successfully on GitHub Actions:
https://github.com/Jabir7006/plateflow/actions/runs/45645105645.

PR #4 is complete.
Merge commit f6ccb2609cdbdd77cc31337dc5318f15487e022a. User explicitly asked
to merge if appropriate; latest head 4c3fa7c was up to date, mergeable, with
CI/Vercel/Preview Comments all passed (3/3), no unresolved review threads.
Local master synced; merged ci/github-actions deleted locally/remotely under
the earlier unused-branch cleanup request. Only master remains.
This post-merge handoff update is documentation only; CI code is unchanged.
Commit d3cc18bf49492910b048572cfcf5a339abf6fdcf on ci/github-actions.
PR https://github.com/Jabir7006/plateflow/pull/4 targets master, mergeable, no
unresolved reviews. Implementation commit d3cc18b has CI, Vercel and Preview Comments all passed;
no unresolved reviews. The CI run verified actual Docker/Action startup and all
commands on Ubuntu; native CI logs confirmed 130 integration tests/1 skip and
11 frontend routes. Final evidence-only docs commit rechecks the same code.
CI run: https://github.com/Jabir7006/plateflow/actions/runs/45636424048.
Commit hooks passed both lint/typechecks. GitHub Actions is enabled.
Base f3ab0e7 (origin/master). User explicitly approved CI implementation and
asked whether release gates mean CD. Explained: CI checks revisions; release
gates are deployment preconditions; CD automates deployment around them.
The prior authorization covered CI commit/push, opening the PR/hosted run,
merging, and deleting unnecessary branches. The user separately authorized and
the assistant activated the required CI ruleset. CD remains outside that scope.
Previous release authorization was fulfilled with PR #3 and the release-doc
push.

CI job defined in .github/workflows/ci.yml: PR/push master, merge-group, manual;
Node from .node-version (26.13.1), pnpm from root packageManager (12.4.1), verified
Action commits and Postgres18.7 manifest digest pinned. Frozen install, native
Temporal check, generated Prisma, lint/typechecks, unit tests, migrate deploy on
loopback-only disposable Postgres, integration tests and all production builds.
Read-only token permissions, no checkout credential persistence, 15min timeout,
concurrency cancellation and dependency-store cache. UTC and Sharp's bundled
binaries make runner configuration explicit. No external DB/provider secrets.

backend/scripts/ci-env.ts creates test-only credentials, derives all three DB
URLs together from the job's fixed loopback service, masks credentials/DSNs and
exports through GITHUB_ENV. It rejects execution outside Actions, invalid ports,
multiline credentials and invalid export paths. Node_ENV remains unset so Next
builds select production. Tenancy migration supplies the baseline restaurant;
no seed or extra business fixtures needed.

**CI validation:** actionlint1.7.12 passes; upstream Action refs and Docker image
manifest verified. Full command sequence passed in a fresh checkout outside the
workspace with no local .env/generated client, on UTC/Node26.13.1/pnpm12.4.1 and
local Postgres18.7: unit **222 / 27 files**, integration **130 / 11 files,
1 expected legacy-seed skip**; lint/typechecks and shared/backend/frontend
production builds pass (11 frontend routes). All 9 migrations applied from empty
DB. Temporary Postgres stopped and checkout/DB data removed. Sanitized logs and
report under backend/.verify/ci-validation-logs/ and ci-clean-result.json.
Hosted GitHub Actions completed successfully on PR #4 implementation commit
d3cc18b. Docker service startup and the pinned Actions worked on Ubuntu24.04.
The final evidence-only documentation push also passed CI. Local tests used
Postgres binaries because this workstation has no Docker. No local
runtime/provider keys copied.

**Last staging release — green (unchanged):** PR
https://github.com/Jabir7006/plateflow/pull/3 merged as008e43b; release docs pushed
at f3ab0e7. Final master Vercel deployment dpl_6RQc6LH4hnoWZdzddCeZcTf1sxeX was
READY on26.x; public health/login200. Prior feature acceptance is below.

**Live release:** backend Render dep-dc3c8su8bjmc73f99oug is live at tested feature
SHA 696679b; logs confirm Node 26.13.1. Frontend Vercel production-target
deployment dpl_6TjJPCDynvyouW9CJs6GCU1786An was READY on 26.x at the same SHA
before merge; master/documentation pushes rebuild the same application code.
Render now tracks master with autoDeploy=no (manual backend releases until
backend CI/migration gates exist). Vercel tracks master, root frontend, Node26.x.
Node26 native Temporal has no polyfill. Local .node-version remains 26.13.1.

**Reporting:** per-restaurant required IANA timeZone; provisioning requires
--timezone. Dashboard and History/stats Today/7d/30d/custom resolve tenant days
on the server, return actual period/zone, and use DST-correct exclusive calendar
upper bounds. Legacy explicit ISO ranges remain inclusive. Sales mean SERVED
orders placed in the period. Existing order timestamps were not rewritten.
Migration 20261124180000_restaurant_reporting_timezone applied to verified
staging via migrate deploy: 9 total migrations. Existing staging-one/staging-two
zones remain UTC; actual existing-tenant zone changes still need scoped review.
Dev/production were not queried or migrated in this release.

**Config defect fixed:** Render DATABASE_URL was staging but DIRECT_URL pointed
at production. Neon endpoint metadata confirmed the mismatch without production
SQL access. User-approved correction made DIRECT_URL the verified staging direct
endpoint before any migration. Both pooled/direct targets now verify as staging.
Never restore that wrong CLI target during an application rollback. Private
rollback metadata retains the corrected staging target; unsafe old value removed.

**Acceptance:** prior local unit 209/26 files and integration 123/10 files
(1 skipped), both lint/typechecks and production builds passed. Commit hooks
reran lint/typechecks. Public deployed checks passed 9/9 reporting/tenant/socket
groups: exact metrics, placement-day sales, tenant/role isolation, ignored client
overrides, matching presets, NY 23/25-hour DST days, Custom validation and scoped
zone error/repair. A got 7 new socket events and 3 updates; B got none.

Browser passed 5-row caps and remaining counts, one summary fetch for 3 status
transitions (sales 27.35/active 6 without reload), blank Custom making zero queries,
one-sided Custom, one period label, CHEF sales “—” and no History money request,
real logout/login to empty New York tenant with no A data, and cookie restoration
after browser reload. Date slot stayed 20px/header 54px during loading and recovery;
503 showed one error without empty metrics. Captured manual Refresh started after
~9ms, Retry after ~38ms. Mobile 390px had valid nav/no horizontal overflow/no Staff.
These timings are observations, not guarantees. Injected browser probes removed;
sessions logged out and all opened tabs closed.

Temporary Dhaka/New York release fixture tenants/chef were deleted by scoped
cleanup. Only staging-one/staging-two remain, both UTC; their data was preserved.
No fixture credentials or dump in the repo. Gitignored operational scripts live
in backend/.verify/: release-api.mjs, github-release-api.mjs,
staging-release-backup.mjs, staging-release-fixtures.mjs, staging-release-check.mjs.
Fixture credentials file was deleted after cleanup. Platform tokens are held in
T3 private files referenced by release-api.mjs; inspect available access first.

**Backup:** before migration, encrypted staging dump and metadata are outside
repo under ~/.local/share/plateflow/backups/staging/ (2026-11-25T11-17-47-203Z).
AES-GCM decrypt roundtrip and pg_restore inventory passed (11 data entries);
plaintext dump deleted. Separate key under ~/.config/plateflow/backup-keys/.
Files 600/directories 700. This was archive verification, not a new restore drill.
Private rollback settings: ~/.config/plateflow/releases/20261125/render-rollback.json.
Staging credentials remain ~/.config/plateflow/staging.env (600); connection
file neon-staging.out was also tightened to 600. Never print secret contents.

**Branch cleanup (2026-11-25):** user explicitly requested it. All candidates
had zero commits outside origin/master; no open PR/other worktree/deployment used
them. Render/Vercel branch settings were read back as master. Deleted local:
dev, diner-menu-redesign, feat/dashboard-live-data, feat/menu-page,
feat/multi-tenant-foundation, feat/public-surface-hardening, feat/tables,
landing-page. Remote deleted: same names except feat/menu-page/feat/tables
(already local-only). Remote deletion was atomic with expected-SHA leases;
local deletion used -d after reachability checks. After PR #4 merge, ci/github-actions was also deleted locally/remotely after
reachability verification and expected-SHA remote deletion. Only master remains
both locally and remotely; it retains every removed tip (9 local/7 remote
branches removed across the cleanup and subsequent CI merge).
No commits lost: every removed tip remains reachable from master. Details in
gitignored backend/.verify/branch-cleanup-result.json.

**Next action:** On implementation request, follow the
[staging release preflight plan](docs/plans/staging-release-preflight.md).
It specifies a read-only gate for the exact CI-approved SHA and the two staging
DB targets. Later release steps stay manual until separately scoped. Future
product priorities are self-serve onboarding, plan gating, and super-admin.
Payments are deferred.

**Changed / CI files (merged through PR #4):**

- .github/workflows/ci.yml
- backend/package.json (ci:env command)
- backend/scripts/ci-env.ts
- backend/tests/unit/scripts/ci-env.test.ts
- backend/tests/integration/ci-environment.test.ts
- docs/CI.md
- docs/DEPLOY-RUNBOOK.md
- MULTI-TENANT-HANDOFF.md

Implementation d3cc18b and evidence 4c3fa7c are merged in f6ccb26. Commit
fe4ed73 recorded the merge and cleanup. The docs branch `docs/plan-first-workflow`
carries `AGENTS.md`, `MULTI-TENANT-HANDOFF.md`, `docs/CI.md`, and
`docs/plans/staging-release-preflight.md`. The ruleset request payload is ignored
at `backend/.verify/master-ci-ruleset.json`.

**Blocker:** None for CI or branch protection. Staging preflight implementation
is pending a task request. Backend deployment remains manual.

**Read, in order:** this section → docs/DEPLOY-RUNBOOK.md → docs/DRILL-LOG.md →
docs/STAGING-DEPLOY-GUIDE.md → docs/BACKUP-RESTORE.md. Older sections below are
background; this section wins when status differs.

**Hard rules:** write/update the plan before implementing the task and link it
here; commit/push only on explicit request;
no secrets/DB URLs/passwords in chat or git; fresh checkout generates Prisma
first; migrate deploy only, never migrate dev or db:seed on shared environments;
real feature tests; preserve tenant isolation; no payments/billing work yet.
Before stopping/context gets low, update Status/Next action/Changed/Blocker.
Repo commits use -F with a file; no Co-Authored-By trailer.

Recheck commands when a new change or failure warrants them:

```bash
pnpm --filter backend db:generate
pnpm --filter backend test:unit
pnpm --filter backend test:integration
pnpm --filter frontend lint
pnpm --filter frontend typecheck
# frontend build needs matching NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME from backend
pnpm --filter frontend build
```

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

| Commit          | What                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dbe59ef`       | `feat(backend): multi-tenant restaurant foundation` — schema, migration, seed, provisioning CLI, test scaffolding                                     |
| `5362e8e`       | `feat(backend): enforce tenant isolation across every query` — the scoping itself, middleware, realtime rooms, contract migration, frontend cache fix |
| `2688f4a`       | `test(backend): cover critical paths with unit and integration suites`                                                                                |
| _(uncommitted)_ | Part 4 — sidebar shows the active restaurant name, plus this handoff update                                                                           |
| _(uncommitted)_ | Tenant-scope regression guard — static AST check in the unit suite, with a documented allowlist for intentional global reads                          |
| _(uncommitted)_ | Real-user journey + image/upload tests — one end-to-end API/socket day, plus Cloudinary/Multer coverage                                               |

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
   actionable message if orphans exist _and_ >1 restaurant exists (ambiguous
   owner — refuses to guess), (c) folds orphans into the sole restaurant if there
   is exactly one, then `SET NOT NULL` on all five tables.

**Why split:** making `restaurantId` required in Part 1 would have broken every
`.create()` (no tenant context existed yet) and left the app non-compiling. The
split let Part 1 land with **zero service changes**. The contract migration then
landed with Part 3, once every writer supplied the value.

## 5. Verified ✅ (re-run these to confirm)

| Check                                                                                       | Result                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prisma validate`                                                                           | valid                                                                                                                                                                                                                                                                    |
| `prisma generate`                                                                           | ok                                                                                                                                                                                                                                                                       |
| `pnpm --filter backend typecheck`                                                           | clean                                                                                                                                                                                                                                                                    |
| `pnpm --filter backend lint`                                                                | clean                                                                                                                                                                                                                                                                    |
| `pnpm --filter backend test:unit`                                                           | **175 tests, 21 files, all pass** (tenant-scope guard, rate limiter, restore helpers, graceful shutdown)                                                                                                                                                                 |
| `pnpm --filter backend test:integration`                                                    | **9 files, 110 passed, 1 skipped (111)** — executed 2026-11-07, ~121s                                                                                                                                                                                                    |
| `pnpm --filter frontend lint` / `typecheck`                                                 | clean (re-run after Part 4)                                                                                                                                                                                                                                              |
| `pnpm --filter frontend build`                                                              | ok (11 routes, Next 16.2.6 / Turbopack)                                                                                                                                                                                                                                  |
| `prisma migrate status` (dev DB)                                                            | up to date, 8 migrations                                                                                                                                                                                                                                                 |
| `prisma migrate status` (test DB)                                                           | up to date, 8 migrations                                                                                                                                                                                                                                                 |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | **No difference** (no drift, dev DB)                                                                                                                                                                                                                                     |
| DB row audit (dev)                                                                          | 1 restaurant (`default_restaurant`); `restaurantId` **NOT NULL** on all 5 tables; **0 orphan rows** (User 2/2, MenuItem 9/9, MenuCategory 5/5, Table 6/6, Order 10/10)                                                                                                   |
| Dev DB after integration run                                                                | unchanged (User 2, MenuItem 9, MenuCategory 5, Table 6, Order 10, OrderItem 14)                                                                                                                                                                                          |
| Test DB after integration run                                                               | returned to baseline (1 `default_restaurant`, 0 users/menu/tables/orders) — cleanup works                                                                                                                                                                                |
| Local browser walkthrough (2026-11-05)                                                      | login → sidebar shows restaurant → menu → QR diner order → live board PENDING→PREPARING→READY→SERVED → diner status updates over sockets → history/stats show the order → second tenant sees an empty history and a cold cache. Test DB returned to baseline afterwards. |

### 5.1 Integration suite details (do not lose this)

The suite is now real, proven, and safe to re-run:

- `backend/.env` has `TEST_DATABASE_URL` → a **separate disposable Neon database**.
  It is _not_ the dev DB: different host and database path were checked explicitly.
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
  `SEED_MANAGER_PASSWORD` _is_ present in `backend/.env`; the skip happens because
  the **data** is absent, not the variable.
- The suite provisions each restaurant through the real
  `prisma/create-restaurant.ts` CLI and deletes exactly what it created. A run
  leaves the disposable DB at its baseline and never touches the dev DB.
- Re-running does not require re-migrating (test DB is already at 8 migrations).
  If you ever point it at a _new_ empty DB, apply migrations first with
  `DATABASE_URL`/`DIRECT_URL` set to that DB (`prisma migrate deploy`; never `migrate dev`).

## 6. Remaining verification ⚠️

The DB/API/socket guarantee is proven by the integration suite, including the
`real-user-journey.test.ts` file that runs one restaurant's whole day through the public API and
real sockets. A **local browser walkthrough** on 2026-11-05 also passed the human path against the
disposable test DB (login, sidebar tenant label, menu, QR order, live status, history/stats, and a
second tenant's empty view). What is **still not verified**:

- **Staging deploy + two real restaurants on public URLs:** the 2026-11-21 staging E2E ran a local
  backend against the staging branch and proved tenant isolation plus live socket isolation, but it
  is not the deployed proxy path. Render and Vercel services still need creating; the checklist is in
  `docs/DEPLOY-RUNBOOK.md` §7.1.
- **Deploy runbook:** written in `docs/DEPLOY-RUNBOOK.md`. It covers Render/Vercel/Neon setup, the
  production env matrix, `TRUST_PROXY`, first launch, release, and rollback. The contract migration
  must be applied with `prisma migrate deploy`; all pre-tenant staff sessions become invalid and
  every user must log in again. Prepare the support note.
- **Backup/restore drill:** the strategy, scripts, and verification are in
  `docs/BACKUP-RESTORE.md`. Both drills passed: the logical `pg_dump` → `pg_restore` round trip
  (2026-11-07) and the Neon branch-from-past/PITR drill (2026-11-09). Evidence is in
  `docs/DRILL-LOG.md`. Production must use a 7-day history window; the disposable test project is
  currently on the 6-hour Free-plan cap.

Two pre-existing UI gaps surfaced during the walkthrough: fake dashboard data
and the dead Staff nav link. Both are now fixed locally (2026-11-24, §0) and await
deploy. Category refresh also passed a deployed staging recheck without code
changes. A real staff directory/shift model and owner-facing timezone settings remain
future work; served-order sales do not represent collected payments.

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
  or `req.ip` will be the proxy and every client will share one bucket. Verified on Render behind
  Cloudflare: `X-Forwarded-For` arrives as `client, cloudflare-egress, render-internal`, so `3` is
  the client and `2` is a per-request Cloudflare IP. Confirm with the §4 burst before launch.
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
  Integration tests that need 429s must override the `RATE_LIMIT_*` variables _before_ importing
  `src/app.ts` (see `tests/integration/public-surface-hardening.test.ts`).
- **`TRUST_PROXY` must match the production proxy chain.** A wrong value buckets every client behind
  the proxy IP and makes the limits useless. On Render behind Cloudflare use `3`; verify with the §4
  burst (one keep-alive connection must walk `remaining` to 0 and then `429`).
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
2. `staff.service.ts` invite: an existing user from _another_ restaurant now gets a
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
