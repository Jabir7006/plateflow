# Staging deploy — step by step (Render + Vercel + Neon)

Plain-language guide for putting **staging** on the real platforms. Assumes the
repo is pushed and the `staging` Neon branch already exists.

Read this with [Deploy runbook](./DEPLOY-RUNBOOK.md) §2–§4. The runbook has the
"why"; this file has the clicks.

> **Staging values (updated 2026-11-25)**
> - Neon branch: `staging` (`br-delicate-math-azov6qa2`), project `plateflow`.
> - Test tenants: `staging-one` (owner-a@staging.plateflow.test) and
>   `staging-two` (owner-b@staging.plateflow.test).
> - Staging DB URLs and tenant credentials: `~/.config/plateflow/staging.env`
>   (mode 600, outside the repo). Never paste these into chat or commit them.
> - Migrations applied: 9, including restaurant reporting timezone; 0 pending.
> - Existing staging-one/staging-two reporting zones remain UTC.
> - Production branch `br-aged-sun-az6xsl7h` is **never** used for staging.

---

## 0. What you need before you start

- GitHub account with access to the repo (Render and Vercel both import it).
- Neon access (already there: `NEON_API_KEY` in `backend/.env`).
- Cloudinary cloud name + key + secret.
- Resend API key + a verified sender (`MAIL_FROM`).
- Two long random secrets for `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET`.
  Generate with:
  ```bash
  openssl rand -base64 48
  ```

---

## 1. Render — backend Web Service

1. Go to <https://dashboard.render.com> → **New +** → **Web Service**.
2. **Connect GitHub** → pick the PlateFlow repo.
   - First time? Render asks you to install its **GitHub App**. Approve it.
     Only you can click this.
3. Fill the form:

   | Field | Value |
   | --- | --- |
   | Name | `plateflow-staging-api` |
   | Region | `Singapore` (same as Neon: `ap-southeast-1`) |
   | Branch | `master` |
   | Root Directory | **leave empty** — must be the repo root |
   | Runtime | `Node` |
   | Auto-Deploy | **Off**; backend releases are manual until CI/migration gates exist |
   | Build Command | `pnpm install --frozen-lockfile && pnpm --filter @plateflow/shared build && pnpm --filter backend build` |
   | Start Command | `pnpm --filter backend start` |
   | Health Check Path | `/health` |

4. **Pre-Deploy Command** (paid plans only):
   `pnpm --filter backend db:migrate:deploy`
   - On the free plan this field is hidden. Run the migration by hand before
     the first deploy (see §4).
5. **Environment → Advanced → Add Environment Variables.** Paste the staging
   matrix (§3). Use the **pooled** URL for `DATABASE_URL`, **direct** for
   `DIRECT_URL`, both from `~/.config/plateflow/staging.env`.
6. Add `NODE_VERSION=26.13.1` (matches the repo's `.node-version`; LTS Lithium).
7. **Create Web Service.** Wait for the build (first one is slow).
8. Check `https://plateflow-staging-api.onrender.com/health` returns `200`
   with `{"status":"ok"}`.

**Free-plan trap:** Render free web services **sleep** after inactivity. The
first request after sleep takes ~30–50 s. Use a ping monitor (uptime robot) if
you want staging always warm.

---

## 2. Vercel — frontend

1. Go to <https://vercel.com> → **Add New…** → **Project**.
2. **Import Git Repository** → pick PlateFlow. Authorize the Vercel GitHub app
   if asked.
3. **Root Directory**: click **Edit**, choose `frontend`.
   Its package.json now declares Node `26.x`; Vercel manages minor/patch versions.
   This is a major-version selection, unlike the exact local/Render 26.13.1 pin.
4. Turn **ON**: *Include source files outside Root Directory*. Required —
   `packages/shared` lives outside `frontend`.
5. **Build and Output Settings** → override:
   - Install Command: `pnpm install --frozen-lockfile`
   - Build Command: `pnpm --filter @plateflow/shared build && pnpm --filter frontend build`
6. **Environment Variables** (build-time — they get baked in):

   | Name | Value |
   | --- | --- |
   | `BACKEND_URL` | `https://plateflow-staging-api.onrender.com` |
   | `NEXT_PUBLIC_API_URL` | `/api/v1` |
   | `NEXT_PUBLIC_WS_URL` | `https://plateflow-staging-api.onrender.com` |
   | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | same as backend cloud |
   | `NEXT_PUBLIC_SELF_SERVE_SIGNUP_ENABLED` | `false` — flip to `true` and redeploy to expose `/signup` |

7. **Deploy.** The URL will be `https://<project>-<hash>.vercel.app`.
8. Open it. It must load the landing page, and `/login` must reach the form.

**Build fails on purpose** if `BACKEND_URL` or `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
is missing. That is the guard working, not a bug.

---

## 3. Staging environment variables

Backend (`DATABASE_URL` / `DIRECT_URL` come from `~/.config/plateflow/staging.env`):

```dotenv
NODE_ENV=production
DATABASE_URL=<pooled staging URL>
DIRECT_URL=<direct staging URL>
APP_URL=https://<your-vercel-url>
ACCESS_TOKEN_SECRET=<random>
REFRESH_TOKEN_SECRET=<random>
MAIL_FROM=PlateFlow <no-reply@staging.example.com>
RESEND_API_KEY=<key>
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
SEED_MANAGER_EMAIL=<anything, e.g. manager@staging.plateflow.test>
SEED_MANAGER_PASSWORD=<random>
TRUST_PROXY=3
JSON_BODY_LIMIT=1mb
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_PUBLIC_MAX=120
RATE_LIMIT_WRITE_MAX=20
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_AUTH_MAX=20
SELF_SERVE_SIGNUP_ENABLED=false
RATE_LIMIT_SIGNUP_REQUEST_MAX=5
RATE_LIMIT_SIGNUP_LINK_MAX=20
```

`SELF_SERVE_SIGNUP_ENABLED=false` keeps `/api/v1/auth/signup/*` at `404`.
The two signup limits are the per-IP request budget for a 15-minute window:
link requests and the shared verify/complete bucket. Counts include successful
calls. On rollback, turn the backend flag off **before** rebuilding the frontend.

### 3.1 Opening self-serve signup

Only enable after the additive `owner_signup_challenge` migration is applied,
`APP_URL` is the exact Vercel origin, rate limits are on, and Resend has a
verified sender for the intended recipient scope. Resend rejects unverified
domains, so test with a controlled inbox first.

1. Deploy with both flags off. Confirm `/signup` and the login-page link are
   absent, and `POST /api/v1/auth/signup/request` returns `404`.
2. Set the backend `SELF_SERVE_SIGNUP_ENABLED=true` and redeploy the API. Request
   one link from a controlled inbox; confirm delivery, the `#token=` fragment,
   the 30-minute expiry, and the 60-second resend cooldown.
3. Set `NEXT_PUBLIC_SELF_SERVE_SIGNUP_ENABLED=true` in Vercel and rebuild the
   frontend — this value is baked in at build time, not read at runtime.
4. Complete one signup end to end. The new owner lands on `/dashboard`; the
   link stops working after completion, and login with the chosen password works.
5. For rollback, see [Deploy runbook §8.5](./DEPLOY-RUNBOOK.md#85-self-serve-signup).

Do **not** set `TEST_DATABASE_URL` on Render. Do **not** run `pnpm db:seed`
against staging or production.

---

## 4. Migrations before the first deploy

Verify both URLs resolve to the Neon **staging** branch before running this.
The app uses the pooled URL; Prisma uses the direct URL. Do not assume the
current Render DIRECT_URL is correct because the app works: on 2026-11-25 it
pointed at production while DATABASE_URL pointed at staging. That mismatch was
explicitly corrected before the timezone migration. Never restore that wrong
CLI target during an application rollback.

If Render has no pre-deploy command, run this locally from `backend/`:

```bash
DATABASE_URL="$(grep '^STAGING_POOLED_URL=' ~/.config/plateflow/neon-staging.out | cut -d= -f2-)" \
DIRECT_URL="$(grep '^STAGING_DIRECT_URL=' ~/.config/plateflow/neon-staging.out | cut -d= -f2-)" \
pnpm exec prisma migrate deploy
```

Then check:

```bash
DATABASE_URL=... DIRECT_URL=... pnpm exec prisma migrate status
```

**Gotcha:** never `eval` a URL that contains `&` into shell variables — `&`
starts a background job and silently truncates the value. Use
`VAR="$(grep ... | cut -d= -f2-)"` as above.

---

## 5. After both are deployed

1. `curl -fsS https://plateflow-staging-api.onrender.com/health`
2. Load the Vercel URL, log in as owner A
   (`owner-a@staging.plateflow.test`, password in `staging.env`).
3. Run the two-tenant E2E from [Deploy runbook](./DEPLOY-RUNBOOK.md) §7.1.
4. Run the `TRUST_PROXY` check (§4 of the runbook) — one client sending ~150
   requests is enough to see the bucket split.
5. Record evidence in [Drill log](./DRILL-LOG.md).

---

## 6. Small things that bite — read before you touch anything

These are the traps found while setting staging up. Each one cost real time.

### Neon

- **The API needs an org id.** `GET /projects` returns
  `400 org_id is required`. Call `GET /users/me/organizations` first, then
  `GET /projects?org_id=<org>`.
- **A branch created without `parent_id` is a child of the default branch**, so
  it copies that branch's data. Staging was created this way and had to be
  truncated. Never create a branch from production without a plan for the data.
- **History window is a plan limit.** Free = 6 hours, Launch = 7 days. PITR can
  only reach back that far.
- **Connection strings have two forms.** Pooled (`...-pooler...`) for the app,
  direct for Prisma CLI, `pg_dump`, `pg_restore`. Swapping them breaks pooling
  or migrations.

### Local shell / Prisma

- **`prisma.config.ts` reads `DIRECT_URL`**, so `DATABASE_URL` alone is not
  enough for CLI commands. Set both.
- **`dotenv` does not override existing env vars.** Exporting
  `DATABASE_URL=...` wins over `.env` — that is how staging overrides prod.
- **Never `eval "$(grep ...)"` a connection string.** `&` in the query string
  backgrounds the command. Use `cut -d= -f2-`.
- **`pnpm db:migrate` / `db push` must never run against staging or
  production.** Only `prisma migrate deploy`.
- **`backend/.env.staging.local` is not gitignored.** Keep staging secrets in
  `~/.config/plateflow/`, never in the repo.

### Auth / cookies

- **Login sets the cookie twice**: first it clears `accessToken` on two paths,
  then sets the real one. A hand-written cookie jar must keep the **last
  non-empty value per name**, or every request sends `accessToken=` (empty) and
  returns `401 Authentication required`.
- **The access cookie is `Path=/api/v1`, 15 minutes.** The refresh cookie is
  `Path=/api/v1/auth`, 30 days.
- **Socket ticket TTL is 60 s**, and the socket connects **directly** to
  `NEXT_PUBLIC_WS_URL`, not through the Next rewrite.
- **Rate limits are off in development** unless `RATE_LIMIT_ENABLED=true`.
  Testing 429 locally needs that flag.

### Frontend / Next

- **`BACKEND_URL` and `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` are read at build
  time.** Change them → redeploy. Runtime edits do nothing.
- **The `/api/v1` rewrite is baked into the build output.** No rewrite at
  runtime.
- **`NEXT_PUBLIC_API_URL` must stay `/api/v1`** (same-origin). Pointing it at
  the API origin makes cookies cross-site and `SameSite=strict` blocks them.
- **Dev server has ~60 s stale cache.** A UI change can look "not working"
  right after a reload; wait or hard-reload.

### Render / Vercel specifics

- **Root Directory must stay empty on Render.** Setting it to `backend` breaks
  the build — `packages/shared` and the lockfile are at the repo root.
- **Vercel needs "Include source files outside Root Directory" ON** for the same
  reason.
- **Render injects `PORT=10000`.** Never hardcode a port in service config.
- **Render's pre-deploy command is paid-only.** Free plan → migrate by hand.
- **Free Render services sleep.** First hit after sleep is slow.
- **Default domains are enough for staging** (`*.onrender.com`,
  `*.vercel.app`). No DNS work. `APP_URL` must point at the Vercel URL.
- **`APP_URL` is not cosmetic.** It is the only allowed CORS origin. A
  placeholder or trailing slash makes every cross-origin call fail —
  and the socket is cross-origin by design (it connects straight to the API),
  so the live kitchen board silently stops updating while polling retries
  forever. Symptom: `Access to XMLHttpRequest at '…/socket.io/…' from origin
  'https://<app>' has been blocked by CORS policy`. Check with
  `curl -sI <api>/api/v1/auth/me -H "Origin: <frontend>" | grep -i access-control`.
- **`TRUST_PROXY=3` on Render**, not `2`. Render's `X-Forwarded-For` at the
  app is `<client>, <cloudflare-egress>, <render-internal>`; `2` selects the
  Cloudflare hop, which changes per request. Symptom: for one client,
  `RateLimit-Remaining` jumps back to `119` and 429s almost never fire. Verify
  with runbook §4; if one client still lands in several buckets, the chain has
  another hop, but do not go past the number of real proxies — a client-supplied
  entry then becomes selectable. Verified on staging 2026-11-22
  (`DRILL-LOG.md` D-2026-11-22): at `3`, one connection gave 120 × `200` then
  `429` from #121, and a forged `X-Forwarded-For` was ignored.

### UI follow-ups (updated 2026-11-24)

- Dashboard summary and live orders now use real tenant-scoped data locally;
  the Staff nav link is removed. These changes await commit/push and deploy,
  then a public staging check (`docs/NEXT-STEPS.md`).
- Category refresh was rechecked on deployed staging: mouse and keyboard create
  both show the new row in the still-open parent dialog without a reload. The
  earlier stale-list claim is retired; no menu code change was needed.
- A real staff directory and shift model are still absent. Dashboard availability
  replaces the fake shift card. The reviewed local change now stores a required
  restaurant IANA timezone and resolves reporting days on the server. Apply the
  additive migration before backend/frontend deploy; verify each existing
  restaurant's actual timezone (UTC is the compatibility backfill). See the
  timezone release note in `DEPLOY-RUNBOOK.md` §12.

### Shutdown / database lifecycle

- **Prisma's pg adapter does not own the pool passed to it.** `prisma.$disconnect()`
  alone leaves connections open; the app ends the pool explicitly on
  `SIGTERM`. Do not remove that.
- **Restores go to a fresh branch or scratch DB first.** Never restore over a
  live environment before verification.

---

## 7. If you get stuck

| Symptom | Likely cause |
| --- | --- |
| Render build fails, `packages/shared` missing | Root Directory set to `backend` |
| Vercel build fails, missing `packages/shared` | "Include source files outside Root Directory" is OFF |
| Frontend builds, every API call 404s | `BACKEND_URL` missing at build time |
| `/health` 404 on Render | wrong health path or service crashed — read the deploy log |
| Login returns 401 after success | cookie jar sending the empty `accessToken` |
| Menu images broken on Vercel | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` wrong or not set |
| Rate limits all share one bucket | `TRUST_PROXY` too low |
| 429s almost never fire; `RateLimit-Remaining` resets to 119 for one client | `TRUST_PROXY` is landing on a per-request edge IP — set `3` on Render |
| Everyone gets 429 at once, or one client's burst is spread over several buckets | `TRUST_PROXY` off by one: read the `X-Forwarded-For` the app receives |
| Socket never connects | `NEXT_PUBLIC_WS_URL` wrong or ticket expired (>60 s) |
| `migrate deploy` says "DATABASE_URL is not defined" | you only set `DIRECT_URL`; CLI needs both |
