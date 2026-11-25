# Drill log

Recorded evidence for backup/restore drills. Procedure and evidence template:
[Backup and restore drill](./BACKUP-RESTORE.md) §6.

Each entry answers three questions: did the restore actually produce usable
tenant data, did verification pass, and how long did it take?

---

## D-2026-11-07 — logical dump → scratch database

| Field | Value |
| --- | --- |
| Drill date (UTC) | 2026-11-07 |
| Operator | Automated run (agent), reviewed locally |
| Result | **Pass** |
| Source | Disposable test database (`neondb`, Neon ap-southeast-1, PostgreSQL 18.6) |
| Target | Scratch database `plateflow_drill_20261107` on the same Neon endpoint |
| Restore point | `plateflow-2026-11-07T15-57-13-567Z.dump` (custom format, 27,359 bytes) |
| Dump SHA-256 | `2120eccd2902c11d48e61bd4c1b3d53427f23f07f25834b221fea5e4b50a025b` |
| Restore command | `RESTORE_TARGET_URL=<scratch> pnpm db:restore -- <dump> --yes` |
| Restore time | 17.3 s (`pg_restore --clean --if-exists --no-owner --no-privileges`) |
| Verification | `RESTORE_VERIFY_URL=<scratch> pnpm db:verify-restore` — all 10 checks passed |
| RTO observed | **< 1 minute** restore + verify (target: ≤ 60 minutes) |

### Row counts

| Table | Source | Restored |
| --- | --- | --- |
| Restaurant | 2 | 2 |
| User | 1 | 1 |
| MenuCategory | 1 | 1 |
| MenuItem | 1 | 1 |
| MenuItemSize | 1 | 1 |
| Table | 1 | 1 |
| Order | 1 | 1 |
| OrderItem | 1 | 1 |
| RefreshToken | 1 | 1 |
| VerificationToken | 1 | 1 |

Counts matched exactly across all ten tables.

### Spot check

| Field | Expected | Restored |
| --- | --- | --- |
| Order id | `cmw6l6psn00060hsbyzvmy9v5` | `cmw6l6psn00060hsbyzvmy9v5` |
| Status | `PREPARING` | `PREPARING` |
| Total | `25.00` | `25.00` |
| Restaurant | `drill-4f1091ab` | `drill-4f1091ab` |
| Items | 2 × `Drill Item 4f1091ab`, `Regular`, `12.50` | 2 × `Drill Item 4f1091ab`, `Regular`, `12.50` |

The fixture represented a real tenant shape: owner with password hash, menu
category/item/size, table/QR code, order + line item, refresh token, and
verification token. The restore reproduced every row and relation.

### Cleanup

- Scratch database `plateflow_drill_20261107` dropped.
- Fixture rows deleted from the test database.
- Temporary dump and fixture files removed.
- Baseline re-confirmed: `Restaurant=1` (`default`), every other table `0`.

### Notes and limitations

- This drill used a **scratch database on the same endpoint**, the documented
  variant in `BACKUP-RESTORE.md` §4.4. It proves the logical dump is readable
  and complete; the Neon branch/PITR path is covered by the D-2026-11-09 entry
  below.
- RTO excludes any provider-side branch/endpoint creation time.
- `pg_dump`/`pg_restore` were client version 18.6, matching the server major
  version.

---

## D-2026-11-09 — Neon branch from a past point (PITR)

| Field | Value |
| --- | --- |
| Drill date (UTC) | 2026-11-09 |
| Operator | Automated run (agent), reviewed locally |
| Result | **Pass** |
| Project | `plateflow` (Neon, `aws-ap-southeast-1`) |
| History window | 21,600 s (6 h, Free-plan cap) |
| Source | `test` branch `br-rough-cloud-azmvo5ed` (root) |
| Target | Branch `pitr-drill-2026-11-09T11-17-46-870-9212ffb5` (`br-silent-cherry-azpjkli9`), created from the past point |
| Restore point | `2026-11-09T11:17:50.518Z` |
| Restore method | Insert marker rows → delete → create branch with `parent_timestamp` → verify |
| Branch create + verify | 7.2 s |
| Total drill | 19.2 s (includes a 10 s safety wait) |
| Verification | `db:verify-restore` — all 10 checks passed on the branch |
| RTO observed | **< 1 minute** (target: ≤ 60 minutes) |

### What was proven

- A marker restaurant + category + item were committed at the restore point.
- After deleting them, the source contained only the `default` restaurant.
- A branch created from the restore point contained all three marker rows
  (`Restaurant=2`; marker category and item present).
- The branch passed every restore check (`migrations`, tenant contract,
  restaurant anchor, orphan checks).
- The source branch was never overwritten and was not modified by the drill.
- The branch was deleted and the test branch baseline re-confirmed:
  `Restaurant=1` (`default`), every other table `0`.

### Notes and limitations

- Only the disposable `test` branch was used. The `production` branch was not
  touched; every API call was pinned to the test branch id.
- This project's history window is **6 hours** (Free-plan cap). Production
  should use the 7-day Launch window described in the runbook.
- This proves branch-from-past/PITR works without touching the source. It does
  not exercise an **in-place instant restore** (which overwrites the root
  branch); that remains a documented recovery option rather than a drill
  target.
- Branch create + verify time excludes the 10 s wait used to make sure the
  marker commit was visible in history.

---

## D-2026-11-21 — staging two-tenant E2E

| Field | Value |
| --- | --- |
| Drill date (UTC) | 2026-11-21 |
| Operator | Automated run (agent), reviewed locally |
| Result | **Pass** |
| Target | Disposable `staging` branch (`br-delicate-math-azov6qa2`, Neon ap-southeast-1) |
| Backend | Built server, staging DB URLs, `PORT=4000` |
| Frontend | Next dev server, `BACKEND_URL=http://127.0.0.1:4000` |
| Tenants | `staging-one` (`Ayesha Karim`, OWNER) and `staging-two` (`Rafiq Hossain`, OWNER) |
| Scope | Read isolation, order placement, live socket isolation |
| Deployed-platform checks | Not run — Render and Vercel services are not created yet |

### Setup

- Created the `staging` branch from the default branch, then truncated every
  table so the clone carried no production or test data. Migrations were
  already applied and `prisma migrate deploy` reported no pending migrations.
- Provisioned two restaurants and their owners with `prisma/create-restaurant.ts`.
- Verified `restaurantId` on every row: `A Starters` and `A Samosa` belong to
  `staging-one`; `staging-two` had zero categories and zero items.

### UI checks

- Owner A logged in, created category `A Starters`, item `A Samosa` (৳5.50),
  and table 1.
- A diner placed one order through the public `/t/<qr>` path. The status page
  showed **Order received** → the order existed in the DB with the correct
  tenant.
- Owner B logged in on the same origin and saw **No menu items yet** and an
  empty **Orders** board, while owner A had a live order.

### Live socket check

`backend/.verify/live-socket-isolation.mjs` (run against the staging backend)
logs in as both owners, exchanges each session for a realtime ticket, and opens
two socket.io connections. It then places an order and advances it to
`PREPARING` and records what each socket received:

| Check | Result |
| --- | --- |
| A received `order:new` | ok |
| A received `order:updated` | ok |
| B received no order events | ok |
| A's order list contains its order | ok |
| B's order list is empty | ok |

**B never received A's events and never saw A's order.**

### Notes and limitations

- This ran against a local backend, not a Render instance. It proves tenant
  isolation at the API, DB, and socket layers; it does **not** prove the
  Render/Vercel proxy chain, `TRUST_PROXY` rate-limit behaviour, or platform
  deploys. Those need the Render and Vercel services.
- The dish created through the UI rendered correctly after a page reload. The
  category list inside the "Manage categories" dialog did not refresh after
  creating a category in the same session; treat as a UI follow-up, not a
  tenant defect.

---

## D-2026-11-22 — first deployed staging check (Render + Vercel + Neon)

| Field | Value |
| --- | --- |
| Check date (UTC) | 2026-11-22 |
| Operator | Automated run (agent) |
| Result | **Pass** |
| Backend | `https://plateflow-staging-api.onrender.com` (Render web service, commit `d8d1317`) |
| Frontend | `https://plateflow-nu.vercel.app` (Vercel, Next rewrite → Render) |
| Database | Neon `staging` branch `br-delicate-math-azov6qa2` (ap-southeast-1) |
| Tenants | `staging-one` (`Ayesha Karim`, OWNER), `staging-two` (`Rafiq Hossain`, OWNER) |
| Scope | platform, cookies, CORS, tenant isolation, realtime, uploads, body limit, rate limits |

This is the first check that exercised the real Render + Vercel + Neon path.
It was run after `APP_URL` was corrected from the guide's placeholder to the
Vercel origin, and re-run after `TRUST_PROXY` was raised from `2` to `3`.

### Platform and transport

| Check | Result |
| --- | --- |
| `GET /health` on Render | `200 {"status":"ok"}` |
| Security headers on an API response | CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, COOP/CORP present |
| Vercel → Render rewrite (`GET /api/v1/t/<token>`) | `200`, staging menu returned |
| Preflight from the Vercel origin | `204`, `allow-origin` = Vercel origin, credentials allowed |
| `APP_URL` as the CORS allow-list | API and socket.io both return the Vercel origin |
| Oversized JSON body | `413` (JSON error shape) |

The first run also confirmed the inverse: while `APP_URL` was still the literal
placeholder, the API and the socket handshake echoed `https://<your-vercel-url>`,
the browser blocked the direct socket connection, and the kitchen board stopped
updating. That is now documented as a trap in `STAGING-DEPLOY-GUIDE.md` §6.

### Auth and tenant isolation

| Check | Result |
| --- | --- |
| Owner A login | `200` |
| Access cookie flags | `HttpOnly; Secure; SameSite=Strict; Path=/api/v1` (15 min) |
| A `GET /auth/me` | `200`, `Staging One` |
| B `GET /auth/me` | `200`, `Staging Two` |
| A `GET /menu/items` | 1 item |
| B `GET /menu/items` | 0 items |
| A `GET /orders` | 8 orders at first check (10 after the later socket runs) |
| B `GET /orders` | 0 orders |
| `deployed-check.mjs` against the API origin | **12/12** |

The database is the staging branch, not production: `staging-one` /
`staging-two` and `A Samosa` exist only there, and `APP_URL` is proven by the
CORS origin echoed on both the API and the socket handshake.

### Realtime, UI, uploads

- Diner flow on Vercel: added `A Samosa`, placed the order, landed on the status
  page (`Order received`).
- Staff board on Vercel: the order count changed `All 8 / New 5` → `All 9 / New 6`
  **without a reload**, so the deployed socket path (`NEXT_PUBLIC_WS_URL` → Render)
  delivers live events.
- `backend/.verify/live-socket-isolation.mjs` run against the public URLs
  (`API_BASE` = Vercel, `WS_BASE` = Render, `WS_ORIGIN` = Vercel): **6/6**.

  | Check | Result |
  | --- | --- |
  | A received `order:new` | ok |
  | A received `order:updated` | ok |
  | B received no order events | ok |
  | A sees its order | ok |
  | B's list is empty | ok |
  | B's list does not contain A's order | ok |

- Image upload (`PUT /menu/items/:id/image` → Cloudinary) returned `200` and a
  `res.cloudinary.com` URL; the item then rendered through `/_next/image`
  (`200 image/webp`).

### Rate limits — verified

`TRUST_PROXY=3` was set on Render and the service redeployed. The limiter is
now keyed on the client:

- One keep-alive connection (one client IP) sending 130 requests: **120 ×
  `200`, then `429` from request 121**, with `RateLimit-Remaining` walking
  `119 → 0` one per request and no resets. This is the correct behaviour.
- A request with a forged `X-Forwarded-For` did **not** open a new bucket; it
  continued the same counter, so the header is not spoofable at this depth.
- Separate connections from this host still alternate between two buckets.
  That is the ISP's CGNAT pool: `api.ipify.org` returns
  `103.162.58.195` and `103.162.58.212` alternately, so it is two real client
  IPs, not a proxy key.

The earlier scatter (with `2`) was Render's
`X-Forwarded-For: <client>, <cloudflare-egress>, <render-internal>`: `2`
selects the Cloudflare hop, which differs per request. `3` selects the client.
Do not use `4`: a client-supplied `X-Forwarded-For` entry would become
selectable.

### Known UI gaps at the time of this drill

- "Manage categories" dialog does not refresh after creating a category (reload fixes it).
- Dashboard cards still use mock data (`frontend/features/dashboard/data.ts`).
- Sidebar "Staff" link 404s.

These historical observations are superseded by the 2026-11-24 recheck below.

---

## D-2026-11-24 — dashboard/nav local acceptance and category staging recheck

- Branch `feat/dashboard-live-data`, base `7c79af5`, uncommitted. Dashboard/nav
  changes are local and have not been deployed.
- Backend lint/typecheck passed; unit suite: 22 files / 181 tests passed;
  integration: 10 files / 117 passed, 1 skipped, 147.90s. Includes summary role
  gates, two-tenant isolation, midnight bounds, distinct occupied tables, READY
  backlog and capped unavailable-item list with exact total count.
- Frontend lint/typecheck and production build passed (11 routes). Required
  public Cloudinary build setting supplied from the existing backend environment;
  no env file, migration or deployment configuration changed.
- Local browser used disposable TEST_DATABASE_URL fixtures and the real app,
  Next rewrite and socket handshake. A's dashboard began at sales 0, active 0,
  occupied 0/2, unavailable 1. New orders updated the live card/metrics without
  reload; serving two orders produced sales 82.05, active 0, occupied 0/2.
  Availability change + Refresh showed 2 unavailable items. CHEF got API sales
  null and UI "—". Real logout/login to empty tenant B showed all zeros, 0/0
  tables, no A menu names and the availability empty state. Mobile nav had no
  Staff link. Simulated API failure showed one inline error; Retry recovered.
- Deployed staging category recheck: Add category via keyboard and via mouse
  both returned POST 201 then GET 200, showing the new row in the still-open
  Manage categories dialog without reload. Existing invalidation works; no menu
  code was changed. All temporary categories were deleted and the staging
  session logged out.
- Local fixture cleanup was audited: test DB returned to 1 baseline restaurant,
  0 users/items/tables/orders. Temporary credentials, servers and preview tabs
  were removed.
  Public staging acceptance of the new dashboard/nav remains after deploy.

### Approved review follow-up — restaurant timezones and dashboard cleanup

The user approved per-restaurant timezones, placement-day sales with explicit
labels and the cleanup package; then delegated defaults/provisioning choices
and approved Temporal. Existing records receive UTC compatibility backfill;
operators must verify actual tenant zones before rollout. New provisioning
requires a valid named IANA `--timezone`. No order timestamps were rewritten.
Dashboard/history/stats return their server-resolved period/timezone; calendar
presets/custom dates use inclusive start/exclusive next-midnight end, including
23/25-hour DST days. Legacy explicit ISO end bounds stay inclusive.

Dashboard event refreshes are bounded to 3s with a trailing call, terminal/new/
connect events only, immediate manual Refresh, and cancellation on unmount or
identity change. Live card caps at oldest 5 plus View all. Error/401 and query/
callback cleanup applied. Reporting fixtures reset per test, freeze only Date,
and pass ISO UTC strings to raw pg queries so timestamp-without-zone columns do
not inherit the test machine's timezone during Date serialization.

Final checks: unit **205 passed / 25 files**; integration **120 passed / 10 files,
1 skipped**, 152.30s. Backend/frontend lint and typecheck pass; Prisma schema
valid; shared build and final frontend build pass (11 routes). Migration deploy,
status (9 applied migrations) and schema diff (no difference) verified only on
TEST_DATABASE_URL. No live staging/dev/production migration or deploy performed.
The revised timezone/UI browser acceptance remains after deploy; original
browser checks above are not evidence for these new refinements.
Post-suite audit: 1 baseline restaurant, 0 users/items/tables/orders; timezone
column is NOT NULL with UTC default. All disposable fixtures were cleaned up.

### Latest LTS upgrade and native Temporal verification

The user requested latest Node LTS and explicitly approved native Temporal with
polyfill removal. Official release index checked 2026-11-24: Node **26.13.1
(Lithium)**, released 2026-11-10. Installed via fnm and selected as local default
and lts-latest. Repo `.node-version`/root engine range pin Node 26; pnpm remains
12.4.1. Deployment documentation now specifies NODE_VERSION=26.13.1, but live
Render environment/runtime was not edited or redeployed.

Removed `@js-temporal/polyfill`; reporting uses native Temporal. Added native
TypeScript Temporal lib while preserving existing DOM typings, and a startup
guard/unit test for runtimes without Temporal. On Node 26.13.1, backend/frontend
lint and typecheck pass; **206 unit tests / 25 files** and **120 integration
tests / 10 files (1 skipped)** pass, integration 144.23s. Both production builds pass (frontend 11 routes); emitted backend module
smoke test returns the correct 23-hour New York DST period using native Temporal.
Fixture audit returned to 1 baseline restaurant, 0 users/items/tables/orders.
No new DB migration, commit, push or deploy.

### Approved re-review fixes — 2026-11-25

- Backend lib is now ES2022 + ESNext.Temporal only; JSON response flexibility is
  isolated to tests/http-json.ts. Compile-only assertions catch accidental DOM
  exposure. Backend source and tests typecheck without DOM.
- Frontend package engines select Node 26.x on Vercel. Its major-only/automatic
  patch policy is documented separately from local/Render's 26.13.1 pin. Actual
  live project settings were not edited.
- Integration reporting time is stubbed through a dedicated clock; real Date
  and dependency deadlines keep advancing (covered by an integration assertion).
- Bad tenant timezone returns readable AppError 500 without echoing its raw
  value; a scoped correction is immediately observed while another tenant stays
  unaffected. No timezone cache was introduced. Repair preview/procedure is in
  DEPLOY-RUNBOOK.md §12.1.
- Matching periods share a label; stale/different periods remain independently
  labelled. Header loading has a reserved date slot. Custom without dates does
  not query or silently expand to all time; API rejects it, and either one-sided
  date bound works. Bounds aliases are documented without removing fields.
- Unit 209 passed / 26 files; full integration 123 passed / 10 files, 1 skipped,
  153.65s. Both lint/typechecks and production builds pass (frontend 11 routes).
  Cleanup audit: 1 baseline restaurant, 0 users/items/tables/orders. No new migration,
  commit/push or live deploy.
