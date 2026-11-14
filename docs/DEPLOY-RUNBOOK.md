# PlateFlow deploy runbook

Operational runbook for the **Render (backend) + Vercel (frontend) + Neon
(Postgres)** stack. It covers staging and production, the first launch, routine
releases, rollback, and the checks that must pass before traffic moves.

Companion document: [Backup and restore drill](./BACKUP-RESTORE.md).

> **Assumptions**
> - Backend: Render **Web Service** (Node, long-running process, WebSockets).
> - Frontend: Vercel **Next.js** project.
> - Database: Neon Postgres. The app uses the **pooled** URL; Prisma CLI and
>   `pg_dump` use the **direct** URL.
> - Media: Cloudinary. Email: Resend.
> - Uploads are disabled if the Cloudinary variables are missing, so treat them
>   as required for a real deployment.

---

## 1. Environments

| Environment | Frontend | Backend | Database |
| --- | --- | --- | --- |
| Local | `http://localhost:3000` | `http://localhost:4000` | local/dev Neon branch |
| Staging | `https://staging-app.example.com` | `https://staging-api.example.com` | separate Neon project/branch |
| Production | `https://app.example.com` | `https://api.example.com` | production Neon root branch |

Rules:

- Staging and production must not share a database, Cloudinary cloud, Resend
  key, or JWT secrets.
- Use a **root branch** for production. Neon instant restore only works on root
  branches.
- Keep `app.` and `api.` under the same registrable domain. The browser talks to
  the API through the Next rewrite, so cookies stay same-site; the socket then
  connects directly to `api.`.

---

## 2. One-time setup

### 2.1 Neon

1. Create a project and keep the default root branch (`main` or `production`).
2. Set **Settings → Postgres → History window** to **7 days** on Launch (or 30
   days on Scale). Free plan is capped at 6 hours. This is the RPO for
   point-in-time restore; see the backup runbook.
3. Copy both connection strings:
   - **Pooled** → Render `DATABASE_URL`
   - **Direct (unpooled)** → Render `DIRECT_URL`
4. Verify the app role can run migrations. Apply migrations only with
   `prisma migrate deploy`; never `prisma migrate dev` or `db push` against a
   shared database.

### 2.2 Render backend

Create a **Web Service** from the repository. Use the repository root as the
service root; do **not** set the root directory to `backend`, because the build
needs `packages/shared` and the workspace lockfile.

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Root Directory | *(empty, repository root)* |
| Build Command | `pnpm install --frozen-lockfile && pnpm --filter @plateflow/shared build && pnpm --filter backend build` |
| Pre-Deploy Command | `pnpm --filter backend db:migrate:deploy` |
| Start Command | `pnpm --filter backend start` |
| Health Check Path | `/health` |
| Node version | `NODE_VERSION=24.18.0` (matches local; bump deliberately) |
| Instances | **1** for the pilot (see §9) |
| Auto-Deploy | After CI checks pass |

The backend build runs `prisma generate && tsc`, so a clean checkout does not
need a committed Prisma client. `prisma.config.ts` reads `DIRECT_URL`; it must
be present at build time and during the pre-deploy command.

The pre-deploy command is available on paid Render services. If the service is
on a plan without it, run the same command as a one-off shell before triggering
the deploy, and treat that as a manual release gate.

### 2.3 Vercel frontend

Import the same repository as a separate Vercel project.

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root Directory | `frontend` |
| Include source files outside Root Directory | **Enabled** (needed for `packages/shared`) |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm --filter @plateflow/shared build && pnpm --filter frontend build` |

`next.config.ts` fails a production build when `BACKEND_URL` or
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is missing. That is intentional: both are
baked into the build and a silent fallback would point production at localhost
or reject every menu image.

### 2.4 DNS

- `app.example.com` → Vercel
- `api.example.com` → Render
- Enable managed TLS in both dashboards; do not terminate TLS yourself.

---

## 3. Environment variables

### 3.1 Backend (Render)

| Variable | Production value / note |
| --- | --- |
| `NODE_ENV` | `production` (enables secure cookies, CSP/HSTS, rate limits) |
| `PORT` | Render injects `10000`; do not hardcode |
| `DATABASE_URL` | Neon **pooled** URL |
| `DIRECT_URL` | Neon **direct** URL (migrations, Prisma CLI) |
| `APP_URL` | Exact frontend origin, e.g. `https://app.example.com` — no trailing slash |
| `ACCESS_TOKEN_SECRET` | Long random secret, unique per environment |
| `REFRESH_TOKEN_SECRET` | Long random secret, unique per environment |
| `MAIL_FROM` | Verified Resend sender, e.g. `PlateFlow <no-reply@example.com>` |
| `RESEND_API_KEY` | Resend production key |
| `CLOUDINARY_CLOUD_NAME` | Production cloud name |
| `CLOUDINARY_API_KEY` | Production key |
| `CLOUDINARY_API_SECRET` | Production secret |
| `SEED_MANAGER_EMAIL` | Required by env validation even when seeding is not run |
| `SEED_MANAGER_PASSWORD` | Strong random value; never run `db:seed` in production |
| `TRUST_PROXY` | Start with `2` (Vercel rewrite + Render proxy); verify §4 |
| `JSON_BODY_LIMIT` | `1mb` |
| `RATE_LIMIT_ENABLED` | `true` |
| `RATE_LIMIT_WINDOW_MS` | `60000` |
| `RATE_LIMIT_PUBLIC_MAX` | `120` |
| `RATE_LIMIT_WRITE_MAX` | `20` |
| `RATE_LIMIT_AUTH_WINDOW_MS` | `900000` |
| `RATE_LIMIT_AUTH_MAX` | `20` |

Do **not** set `TEST_DATABASE_URL` in Render. The integration suite is a local
and CI concern, and it refuses to run without a disposable database anyway.

### 3.2 Frontend (Vercel)

Set these for **Production** and **Preview** as appropriate. They are read at
build time.

| Variable | Production value / note |
| --- | --- |
| `BACKEND_URL` | `https://api.example.com` |
| `NEXT_PUBLIC_API_URL` | `/api/v1` — keep the same-origin proxy |
| `NEXT_PUBLIC_WS_URL` | `https://api.example.com` — no trailing slash |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Same cloud name as the backend |

If `NEXT_PUBLIC_API_URL` is pointed at the API origin directly, cookies become
cross-site and `SameSite=strict` will block them. Keep the rewrite.

---

## 4. Verify `TRUST_PROXY` before launch

The request path is:

```text
browser → Vercel edge/rewrite → Render edge proxy → Express
```

Express must trust exactly the hops that are actually in front of it. If the
number is too low, `req.ip` is a proxy address and every client shares one rate
limit bucket. If it is too high, a client can spoof `X-Forwarded-For`.

Procedure (staging only):

1. Set `TRUST_PROXY=2` on Render and redeploy.
2. From two networks/devices, send enough public requests to observe the
   `RateLimit` headers. Each client should get its own quota.
3. If they share a bucket, try `3`; if one client can spoof its bucket by
   changing `X-Forwarded-For`, the value is too high.
4. Remove any temporary debug logging you added while checking. Do not add a
   public IP-echo endpoint to production.

Re-check this whenever you add a CDN, load balancer, or custom proxy.

---

## 5. Pre-deploy checklist

Run from the repository root unless noted.

```bash
pnpm --filter backend lint
pnpm --filter backend typecheck
pnpm --filter backend test:unit
pnpm --filter backend test:integration
pnpm --filter frontend lint
pnpm --filter frontend typecheck
pnpm --filter frontend build
```

Also confirm:

- [ ] `git status` is clean; the commit being deployed is the one CI approved.
- [ ] No `.env`, dump, or build output is staged.
- [ ] Migration review: only additive/backward-compatible steps, or a documented
      expand/contract plan.
- [ ] A fresh backup exists (see backup runbook) if the release changes data.
- [ ] `prisma migrate status` is clean against staging.
- [ ] Render and Vercel env vars match §3; no staging secrets in production.
- [ ] Support note is ready if sessions will be invalidated (§8).

### 5.1 First production launch

1. Create the production Neon branch and apply migrations through the Render
   pre-deploy command.
2. Create the first restaurant with the admin CLI **against production** only
   when you intend to onboard it:
   ```bash
   pnpm --filter backend db:create-restaurant -- \
     --name "Restaurant Name" --slug restaurant-slug \
     --owner-name "Owner Name" --owner-email owner@example.com
   ```
   The password is read from `PLATEFLOW_OWNER_PASSWORD`, stdin, or
   `--owner-password-file`; it is never a command-line value.
3. Do **not** run `pnpm --filter backend db:seed` in production. The seed is for
   local demo data and would create `default`/`My Restaurant`.
4. Smoke test §7 before announcing the URL.

---

## 6. Release procedure

### 6.1 Normal release

1. Freeze merges to the deploy branch.
2. Run the pre-deploy checklist (§5).
3. Take a backup if the release runs a migration or changes data
   ([backup runbook](./BACKUP-RESTORE.md)).
4. Deploy the backend on Render. The pre-deploy command runs
   `prisma migrate deploy`; the new instance must pass `/health` before traffic
   moves.
5. Deploy the frontend on Vercel. Promote only after the preview looks correct.
6. Run the smoke tests (§7).
7. Watch logs and error rates for at least 15 minutes.
8. Unfreeze merges and note the release in the [drill log](./DRILL-LOG.md).

### 6.2 Migration rules

- `prisma migrate deploy` is the only migration command in shared environments.
- Never run `prisma migrate dev` or `prisma db push` against staging or
  production; both can propose a destructive reset.
- Migrations are forward-only. Write them so the previous app version can still
  read the schema during a rolling deploy (add columns/tables first, backfill,
  remove old fields in a later release).
- If a migration fails, the Render deploy fails and the previous instance keeps
  running. Do not retry blindly; inspect `_prisma_migrations` and the migration
  SQL first.

### 6.3 Shutdown behavior

Render sends `SIGTERM` before replacing an instance. The backend handles it in
`src/lib/graceful-shutdown.ts`: socket.io disconnects its clients and closes the
HTTP server, then Prisma disconnects and the pg pool ends. A 10 s watchdog
force-closes remaining connections and exits non-zero if a step hangs. A local
smoke test (built server, test DB, `/health`, then `SIGTERM`) exits 0; re-run it
after changing realtime or database lifecycle code.

---

## 7. Smoke tests

Run after every deploy. Use a real browser session for the cookie path.

```bash
# API liveness (Render)
curl -fsS https://api.example.com/health

# Security headers and the public rate-limit headers
curl -fsSI https://api.example.com/api/v1/t/not-a-real-token

# Frontend
curl -fsSI https://app.example.com
```

Browser checklist:

- [ ] Login succeeds and the sidebar shows the restaurant name.
- [ ] Refresh the page; the session is restored (cookie path + `APP_URL`).
- [ ] Open the menu and a table QR page.
- [ ] Place a test order and watch it appear on the live board.
- [ ] Advance the order through the lifecycle; the diner status updates over
      the socket without a manual refresh.
- [ ] History and stats show the order.
- [ ] A second restaurant sees none of the first restaurant's data.
- [ ] Upload a menu image; the Cloudinary URL renders through `next/image`.
- [ ] Send enough public requests to see a `429` with the JSON error shape, then
      confirm a different client still has quota (`TRUST_PROXY`).
- [ ] An oversized JSON body returns `413`, not `500`.

### 7.1 Staging two-tenant E2E

This is the check the automated suite cannot do: two real restaurants, separate
browser profiles/devices, real cookies, and real WebSocket separation.

1. Provision two restaurants against the staging database with distinct owners.
2. Use two browser profiles (or one normal + one private window) on separate
   devices if possible.
3. Owner A creates a category, item, table, and order. Owner B must see an empty
   menu/history and must not receive A's socket events.
4. Keep both boards open; advance A's order and confirm only A's board updates.
5. Confirm the diner status page updates for the correct order token only.
6. Record the result in the [drill log](./DRILL-LOG.md).

---

## 8. Rollback

### 8.1 Frontend

Vercel keeps immutable deployments. Open **Deployments**, select the last known
good deployment, and promote/roll it back. No build is needed.

### 8.2 Backend

Render keeps recent build artifacts. Open **Deploys**, select the last successful
deploy, and **Rollback**. Dashboard rollback disables auto-deploy as a
safeguard; re-enable it after the incident.

A code rollback does **not** undo a database migration. If the new code wrote
data in a shape the old code cannot read, fix forward or restore to a verified
branch; do not run a destructive down-migration on production.

### 8.3 Database

Use [Backup and restore](./BACKUP-RESTORE.md). In short:

1. Restore to a **new Neon branch**, never over production first.
2. Verify with `pnpm db:verify-restore`.
3. Switch Render's `DATABASE_URL`/`DIRECT_URL` only after verification.
4. Rotate `ACCESS_TOKEN_SECRET`/`REFRESH_TOKEN_SECRET` if the restore rolled
   back session data; everyone should log in again.

### 8.4 Known session invalidation

The multi-tenant contract migration invalidates pre-tenant staff sessions.
After the first rollout that includes it, every existing user must log in again.
Tell support and include it in the release note.

---

## 9. Scaling and single-instance assumptions

The pilot runs **one** backend instance. Two features are process-local:

- `express-rate-limit` uses an in-memory store.
- socket.io broadcasts directly from the order service.

Before scaling to more than one Render instance:

- Add a shared rate-limit store (Redis or Render Key Value) so quotas are
  global.
- Add the socket.io Redis adapter and sticky sessions, or move realtime fan-out
  to a shared bus.
- Re-check `TRUST_PROXY` and health-check behavior with the new proxy chain.

---

## 10. Monitoring and incident checks

Minimum:

- Render: health-check status, deploy logs, 5xx rate, restarts, memory/CPU.
- Vercel: build status, function logs, deployment errors.
- Neon: storage, compute, history-window usage, connection count.
- Resend and Cloudinary: delivery/upload failures.
- An external uptime check against `https://api.example.com/health`.

Troubleshooting quick reference:

| Symptom | First checks |
| --- | --- |
| Login loop / session not restored | `APP_URL` exact origin, HTTPS, `SameSite`/`Secure` cookies, `NEXT_PUBLIC_API_URL` still `/api/v1` |
| Sockets fail or reconnect forever | `NEXT_PUBLIC_WS_URL` points at API, `APP_URL` matches frontend origin, one backend instance |
| Everyone gets 429 at once | `TRUST_PROXY` too low; Redis store needed after scaling |
| 413 on normal requests | `JSON_BODY_LIMIT` too low or client sending a huge payload |
| Menu images broken | Backend/Vercel Cloudinary cloud-name mismatch; `next.config.ts` remote pattern |
| Build fails on Render | `DIRECT_URL` missing at build, Prisma generate failed, shared package not built |
| Build fails on Vercel | `BACKEND_URL` or `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` missing at build |
| Migration hangs/fails | Neon compute cold start, `DIRECT_URL` unreachable, lock from another migration |
| 502/503 from Render | health check failing, DB unreachable, process crash; check deploy logs |

The current `/health` route is **liveness only** (it does not query the
database). Keep the Render check on it so a cold Neon compute does not cause
false restarts, and monitor the database separately.

---

## 11. Security checklist

- [ ] Separate secrets per environment; rotate after any suspected leak.
- [ ] No `.env` or dump files in git; backups encrypted at rest.
- [ ] Render/Vercel/Neon accounts use 2FA and least-privilege access.
- [ ] `MAIL_FROM` uses a verified Resend domain.
- [ ] `RATE_LIMIT_ENABLED=true` and `TRUST_PROXY` correct.
- [ ] Neon connections use TLS (`sslmode=require`); app uses the pooled URL.
- [ ] Sessions can be invalidated by rotating the JWT secrets.
- [ ] Cloudinary upload preset/keys scoped to the production cloud.

---

## 12. Known gaps / follow-ups

- No structured request logging or external error tracker yet. Add before real
  traffic if support volume grows.
- Dashboard cards still use mock data, and the sidebar "Staff" link has no page
  (see `MULTI-TENANT-HANDOFF.md`).
- Rate limits and sockets are single-instance only (§9).
