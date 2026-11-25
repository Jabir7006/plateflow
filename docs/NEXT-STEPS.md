# Next steps — dashboard live data, staff nav, category refresh

**Written:** 2026-11-24 · **Base:** `master` @ `7c79af5` (in sync with `origin/master`)
**Staging:** API `https://plateflow-staging-api.onrender.com` · web
`https://plateflow-nu.vercel.app`

This is a work order, not a session log. It is written so another AI can execute
it without the conversation that produced it. Read `AGENTS.md` and
`MULTI-TENANT-HANDOFF.md` §0 first; this file only covers the three UI gaps the
user picked to fix next.

**Executed 2026-11-24:** Tasks A and B are implemented on
`feat/dashboard-live-data` (uncommitted, base `7c79af5`). Task C's stale-list
claim did not reproduce on deployed staging: both mouse Create and keyboard
submit refreshed the still-open parent dialog, with POST 201 followed by GET
200. No menu code changed; temporary categories were deleted. The instructions
below preserve the original work order; do not repeat completed work.

Validation: backend lint/typecheck, 181 unit tests (22 files), 117 integration
tests (10 files, 1 skipped), frontend lint/typecheck/build all pass. The build
needs `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` supplied from the matching backend
environment because the existing local frontend env omits it. Local browser
checks against disposable TEST_DATABASE_URL fixtures passed: socket-driven
orders/tiles and served sales, manual Refresh, loading placeholders, one inline
error + Retry recovery, CHEF sales null/"—", real logout/login to empty tenant B,
and mobile navigation. Fixtures and temporary credentials were removed.

**Released (2026-11-25):** PR https://github.com/Jabir7006/plateflow/pull/3
merged as 008e43b after public staging acceptance. Staff nav (62631a3), live
reporting (4157023) and release docs (696679b) were pushed. Render now runs Node
26.13.1 and tracks master with auto-deploy disabled; Vercel uses 26.x/master.
Staging has 9 migrations and existing UTC zones. The misconfigured staging
DIRECT_URL was corrected from production before migration; production was not
queried or modified. Deployed reporting/tenant/socket checks passed 9/9 groups,
and browser dashboard/history/roles/mobile/loading/error/session checks passed.
Temporary fixture tenants were removed. See handoff §0 and DRILL-LOG.md for the
current state; the original work order below is historical.

**Approved review follow-up (2026-11-24):** the user chose restaurant timezones,
placement-day sales with explicit labels, and the refresh/card/query/error/test
cleanup package. They delegated defaults/provisioning decisions and approved
`@js-temporal/polyfill`. The resulting change uses UTC compatibility backfill
for existing rows (verify each real zone before rollout), mandatory explicit
`--timezone` for new provisioning, and server-resolved Today/7d/30d/custom days
for dashboard/history/stats. Responses carry the period/timezone and calendar
ranges use exclusive next-midnight bounds. Existing timestamps and legacy ISO
range behaviour are preserved. No servedAt or payment model was added.

Dashboard summary event refreshes are bounded to 3 seconds with a trailing call;
only new, terminal and connect events trigger them. Manual Refresh runs immediately
and cancels pending trailing work; logout/unmount resets the timer. Live card
shows the oldest five orders plus View all. Empty error sections are removed,
API error messages are used and 401s route to login. Tests now use a fixed Date
clock and fresh reporting rows per case, cover unknown roles, DST, differing
tenant days, custom bounds, required timezone provisioning and refresh timing.
The original work order below is historical; its "no migration"/server-local
day instructions are superseded by this explicitly approved review scope.

Final follow-up checks: 205 unit tests / 25 files and 120 integration tests /
10 files (1 skipped) pass; both lint/typechecks, shared/frontend builds and
Prisma validation pass. Test DB has all 9 migrations applied with no schema
drift. The migration and revised timezone/UI browser acceptance still need
the live release sequence; no commit/push/deploy was performed.

**Runtime follow-up:** user explicitly requested latest Node LTS, then approved
native Temporal and polyfill removal. Official latest LTS checked 2026-11-24:
**26.13.1 (Lithium)**. Installed/selected as local fnm default and lts-latest;
repo `.node-version`/engine range and deploy docs pin that version. pnpm remains
12.4.1. `@js-temporal/polyfill` was removed; backend TypeScript includes native
Temporal declarations and startup fails clearly if Temporal is absent.
Render's live runtime is unchanged; set NODE_VERSION=26.13.1 at release.
Node26/native checks: 206 unit tests, 120 integration tests (1 skipped), both
lint/typechecks and production builds pass; fixtures returned to baseline.

**Approved re-review refinements (2026-11-25):** backend DOM libs removed;
test JSON typing is confined to a transport helper, with compile-only assertions
that window/document are unavailable to backend code. Frontend engines select
Vercel Node 26.x (platform-managed patches), while local/Render stay 26.13.1.
Reporting uses a dedicated injectable clock, so integration clients and their
Date-based deadlines remain real. Timezones still come freshly from tenant rows;
invalid config returns a readable operational 500, with a validated/scoped repair
preview documented in the runbook. OrderStats bound aliases are documented.

Matching history/sales periods share one label; independently fetched different
cached periods retain their own labels until they align, including role/error
states. Dashboard header reserves its reporting-date slot during loading.
Empty Custom waits for at least one date, disables both queries, and is rejected
by the API; open-ended custom ranges remain supported. No new migration or live
deploy-settings change in this follow-up. Current final checks are in handoff §0.

Goal: remove the last visible fake data from the staging dashboard and stop the
dead links, without touching the tenancy model, payments or infrastructure.

---

## 0. Start here

```bash
cd /home/jabir/Projects/plateflow
git switch master && git pull --ff-only
git switch -c feat/dashboard-live-data
```

Baseline (must be green before any change):

```bash
cd backend && pnpm db:generate && pnpm test:unit        # 175 tests / 21 files
cd .. && pnpm --filter frontend lint
pnpm --filter frontend typecheck
pnpm --filter frontend build
```

Rules that apply to all three tasks:

- Commit only if the user asks. One commit per task, conventional messages.
- Do not add a migration for anything here (no schema change is needed).
- Never `prisma migrate dev`; never `db:seed` against staging/production.
- Do not touch `TRUST_PROXY`, rate limits, CORS, cookies or deploy config.
- Payment/billing is out of scope. Do not introduce a `Payment` model.
- Every new Prisma query must be `restaurantId`-scoped; `pnpm test:unit` runs
  `tenant-scope.test.ts` and fails closed on unscoped models.
- The frontend has **no test runner**. Do not invent one unasked. Verify the
  frontend with lint + typecheck + build + a manual staging check.

---

## Task A (primary) — Dashboard must show real data

### Why

`frontend/features/dashboard/data.ts` is mock data. On the live staging site the
dashboard shows `৳18,420`, "7" active orders, "9 / 14" tables, "2 items", three
fake orders and a fake "Abdul Hakim — Chef". That is the first screen after
login, so it is the most visible wrong thing left.

### What the database can actually answer (verified, do not re-invent)

| Tile / card | Real source | Note |
| --- | --- | --- |
| Sales today | `Order.total` where `status = SERVED` and `createdAt` is today | There is **no payment model**. Call it "Sales today (served)", never "Revenue collected". |
| Active orders | `Order` where `status in (PENDING, PREPARING, READY)` | Same definition as `frontend/features/orders/status.ts` → `isActiveStatus`. |
| Tables occupied | distinct `Order.tableId` among active orders | `Table` has **no** occupancy column. Total is `Table.count` for the tenant. |
| Out of stock | `MenuItem` where `isAvailable = false` | Real field, per tenant. |
| Live orders list | `GET /api/v1/orders` (already exists) | Reuse the existing hook, not a new fetch. |
| "Staff on shift" | **Not answerable** | No shift/roster model, and no staff list endpoint. Replace this card; do not fake it. |

`GET /api/v1/orders/stats` already computes sales, but it is `OWNER`/`MANAGER`
only and returns every status. The dashboard is visible to every staff role, so
do **not** call it from the dashboard — a chef would get a 403 and a broken tile.

### Backend

New module `backend/src/modules/dashboard/`:

- `dashboard.service.ts` — one tenant-scoped aggregation, returns a plain object.
- `dashboard.controller.ts` — thin: `requireTenant(req)`, call the service,
  `sendResponse`.
- `dashboard.routes.ts` — `router.use(authenticate, tenantContext,
  requireRole(Role.OWNER, Role.MANAGER, Role.CHEF, Role.WAITER))`, then
  `router.get("/summary", getDashboardSummary)`.
- Mount in `backend/src/app.ts` next to the other authenticated surfaces:
  `app.use("/api/v1/dashboard", dashboardRoutes);`

Contract in `packages/shared/src/types/dashboard.types.ts`, exported from
`packages/shared/src/index.ts`:

```ts
export interface DashboardSummary {
  // null when the viewer may not see money (CHEF / WAITER), mirroring the
  // /orders/stats gate. Never send a number the role cannot see.
  salesToday: number | null;
  activeOrders: number;
  tables: { occupied: number; total: number };
  outOfStock: { count: number; items: Array<{ id: string; name: string }> };
}
```

Queries (all with `restaurantId` from the tenant context):

```ts
const active = await prisma.order.findMany({
  where: { restaurantId, status: { in: ["PENDING", "PREPARING", "READY"] } },
  select: { tableId: true },
});

const totalTables = await prisma.table.count({ where: { restaurantId } });

const unavailable = await prisma.menuItem.findMany({
  where: { restaurantId, isAvailable: false },
  select: { id: true, name: true },
  orderBy: { name: "asc" },
});

// salesToday, OWNER/MANAGER only:
const groups = await prisma.order.groupBy({
  by: ["status"],
  where: { restaurantId, status: "SERVED", createdAt: { gte: startOfToday, lt: startOfTomorrow } },
  _sum: { total: true },
});
```

Details that matter:

- `occupied` is `new Set(active.map(o => o.tableId)).size`, **not** `active.length`
  (one table can have two active orders).
- `total` is a `Decimal`; convert with `.toNumber()` at the boundary. Return
  `number`, not a string.
- "Today" is server-local midnight-to-midnight, the same convention
  `createdAtRange` in `order.service.ts` uses. Per-restaurant timezones do not
  exist yet — say so in a comment and add it to the known-gaps list, do not
  silently assume UTC.
- `outOfStock.count` is the full count; `items` may be capped (e.g. first 5) for
  the card. If you cap it, return `count` separately so the tile stays exact.
- Do not use `$queryRaw`; the tenant-scope guard rejects it.

### Frontend

- `frontend/features/dashboard/api.ts` → `getDashboardSummary()` via
  `apiRequest` (same-origin `/api/v1`, cookies ride along).
- `frontend/features/dashboard/hooks/use-dashboard-summary.ts` → React Query,
  `queryKey: ["dashboard", "summary"]`, `staleTime: 30_000`,
  `refetchOnWindowFocus: true`.
- Live orders card: reuse `useLiveOrders()` from
  `frontend/features/orders/hooks/use-live-orders.ts` (it already owns the
  socket, the ticket handshake and the 30 s fallback poll). Pass `onNewOrder`
  and invalidate `["dashboard", "summary"]` there so the tiles move when an
  order lands or is advanced. Reuse `STATUS_PILL` from
  `frontend/features/orders/status.ts` for the badges and delete the duplicate
  `STATUS_BADGES` map in `live-orders-card.tsx`.
- Tiles: "Sales today (served)" (hidden or "—" for chef/waiter when
  `salesToday === null`), "Active orders", "Tables occupied" as `x / y`,
  "Out of stock" as `n items` with the destructive accent.
- Replace `StaffShiftCard` with `OutOfStockCard`: list `outOfStock.items`
  (name only), empty state "Everything's available." Delete `StaffShiftCard`,
  `StaffOnShift` and the mock `staffOnShift`.
- Loading: skeletons for tiles and cards, same pattern as
  `features/menu/components/category-list-skeleton.tsx`. Error: one inline
  "Couldn't load your dashboard." + Retry (`refetch`), not a toast storm.
- The header's "Refresh data" dropdown item currently toasts "Mock data…".
  Replace the handler with `queryClient.invalidateQueries()` on both
  `["dashboard", "summary"]` and `activeOrdersKey`; drop the mock wording.
- Delete `frontend/features/dashboard/data.ts` once nothing imports it. Keep the
  money formatting in `features/menu/format-price.ts` (`৳` already correct).
- Note: `dashboard/page.tsx` is a static server shell; all fetching is client
  side. Keep it that way — the session lives in an httpOnly cookie.

### Tests (backend; the frontend has none)

`backend/tests/integration/dashboard-summary.test.ts` — seed two tenants:

- Tenant A: 2 tables, 3 menu items (exactly 1 `isAvailable: false`), orders
  today = PENDING (table 1), PREPARING (table 1, second order on the same
  table), SERVED (table 2), CANCELLED; plus 1 SERVED order from yesterday.
- Assertions for A's OWNER:
  `activeOrders === 2`, `tables.occupied === 1` (two active orders share table
  1), `tables.total === 2`, `outOfStock.count === 1` and the right item name,
  `salesToday` equals only today's SERVED total (yesterday's is excluded).
- Role gate: `CHEF` gets `200` with `salesToday === null`; `OWNER` gets a number;
  no session gets `401`.
- Isolation: Tenant B's numbers contain none of A's rows (B with no data →
  all zeros, empty items). Also assert a B-owned order/table can never shift A's
  counts.
- Edge: an order that is SERVED but was created yesterday must not appear in
  `salesToday`; an order with two active tickets on one table counts once in
  `tables.occupied`.

Optional unit test `backend/tests/unit/dashboard/summary.test.ts` if you extract
the pure projection (statuses + rows → summary). Prefer extracting it.

### Acceptance

```bash
cd backend && pnpm test:unit && pnpm test:integration   # both green, guard included
cd .. && pnpm --filter frontend lint && pnpm --filter frontend typecheck && pnpm --filter frontend build
grep -rn "18,420\|Abdul Hakim\|Mock data" frontend --include=*.ts --include=*.tsx   # no hits
```

Manual on staging (after deploy, or locally against the staging DB): log in as
the `staging-one` owner → every tile matches the DB; mark a menu item
unavailable in Menu → "Out of stock" increments on reload; place an order from a
table link → "Active orders" increments without a reload (socket). Then log in
as `staging-two` → different numbers, never `staging-one`'s. Credentials live in
`~/.config/plateflow/staging.env` (never in chat or a commit).

---

## Task B — Sidebar "Staff" link 404s

`frontend/features/dashboard/navigation.ts` lists `{ label: "Staff", href:
"/staff" }`, but no `frontend/app/(protected)/staff/page.tsx` exists. Both the
desktop sidebar and the mobile bottom bar render the same `NAV_ITEMS`, so one
edit fixes both.

**Do now (2 minutes):** remove the `Staff` entry and the now-unused `Users`
import from `navigation.ts`. Then `grep -rn '"/staff"' frontend` and make sure
nothing else links there. This is the honest fix while there is no page.

**Do not** build a fake staff page. If the user later wants the real one, that is
a separate feature: `GET /api/v1/staff` (tenant-scoped `User` list: id,
fullName, email, role, status; `OWNER`/`MANAGER` only), a `/staff` page with the
existing invite button, an integration test for the role gate and tenant
isolation, and the nav entry added back. Log it in the known-gaps list instead
of sneaking it into this task.

---

## Task C — "Manage categories" dialog does not refresh (verify first)

The note in the handoff may be **stale**. `useCreateMenuCategory` in
`frontend/features/menu/hooks/use-menu-category-mutations.ts` already calls
`queryClient.invalidateQueries({ queryKey: menuCategoriesKey })` on success, and
`CategoryList` reads that exact key. There is no obvious bug in the current
code.

So: reproduce on staging before changing anything.

1. Menu → Manage categories → Add category → save.
2. Does the list inside the dialog show the new row without closing it?

- **If yes:** the gap is already fixed. Remove the claim from the handoff /
  known-gaps list, change no code, and say so in the commit message.
- **If no:** capture the failing step, then check, in order: (a) the dialog and
  the page share one `QueryClient` (they do via the app provider — confirm), (b)
  `menuCategoriesKey` is imported from the same module on both sides, (c) the
  create mutation actually resolves (field-level 409 errors are intentionally
  left to the form), (d) whether the *menu page* grouped by category is the
  stale part rather than the dialog — that would be a missing
  `menuItemsKey` invalidation, a different fix.

Add a regression test only if you change code, and only at the layer where the
bug lives. There is no frontend runner, so a React Query invalidation bug is
verified manually on staging; do not bolt on Jest/Vitest for this.

---

## Commit plan (only if the user asks)

```bash
git commit -F /tmp/msg-a   # feat(dashboard): read live summary instead of mock data
git commit -F /tmp/msg-b   # fix(nav): drop the dead Staff link
git commit -F /tmp/msg-c   # fix(menu): refresh categories after create   (only if it reproduces)
```

Repo convention: `git commit -F <file>` (heredocs drop the last line), no
`Co-Authored-By` trailer, no push without explicit permission.

## Known gaps to keep logged (do not fix here)

- No per-restaurant timezone → "today" is server-local.
- No staff roster/shift model → the dashboard shows out-of-stock items instead.
- No staff directory page (`GET /staff` list) → nav entry removed for now.
- No payment model → "sales" means SERVED order totals, not collected money.
- Dashboard and `/orders` each open their own socket connection (pre-existing
  pattern); a shared socket provider is a later cleanup.
