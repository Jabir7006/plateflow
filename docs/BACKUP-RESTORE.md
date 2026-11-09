# Backup and restore drill

How PlateFlow backs up its Postgres data, how to prove a restore works, and what
to do during a real recovery. The deploy sequence lives in
[Deploy runbook](./DEPLOY-RUNBOOK.md).

> **Rule:** restore into a **new Neon branch** first. Never run `pg_restore`
> over the live production database, and never point production traffic at an
> unverified restore.

---

## 1. Targets

| Metric | Target | How |
| --- | --- | --- |
| RPO (data loss) | ≤ 5 minutes | Neon instant restore / history window |
| RPO (off-platform) | ≤ 24 hours | Nightly logical dump stored off Neon |
| RTO (restore + verify) | ≤ 60 minutes | Neon branch + verification script |
| Drill cadence | Quarterly, and before any risky migration | This document |

Neon's history window is the primary recovery control. Set it to **7 days** on
Launch (30 days on Scale; Free is capped at 6 hours). A longer window increases
history storage cost, not compute cost.

---

## 2. What is and is not backed up

| Asset | Covered by | Notes |
| --- | --- | --- |
| Postgres data | Neon PITR + logical dump | All tables, including sessions |
| Schema/migrations | Same | `_prisma_migrations` is part of the dump |
| Cloudinary menu images | **No** | External service; keep the cloud active and rely on its retention, or export assets separately |
| Resend state | **No** | Email is a delivery service, not application data |
| Render/Vercel env vars | **No** | Keep an encrypted secret inventory outside the repo |
| Application code | Git | Tags/commits are the source of truth |

A database restore does not bring back deleted Cloudinary assets or sent email.

---

## 3. Primary recovery: Neon instant restore / branch

Neon keeps a continuous change history. Use it for accidental deletes, bad
migrations, and “restore to five minutes ago”.

### 3.1 Safe drill (non-destructive)

Instead of restoring production, create a branch from a past point in time and
verify it. This exercises the same recovery data without touching production.

**Console**

1. Open the production project → **Branches** → **Create branch**.
2. Choose **From a past point in time** (or the history/Time Travel option).
3. Pick a timestamp 10–15 minutes ago.
4. Name it `drill-YYYYMMDD-HHMM`.
5. Wait for the branch to become ready.

**API** (if you automate this)

```bash
curl -X POST \
  "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": {
      "name": "drill-20261107-1200",
      "parent_id": "'"$NEON_PRODUCTION_BRANCH_ID"'",
      "parent_timestamp": "2026-11-07T11:45:00Z"
    },
    "endpoints": [{ "type": "read_write" }]
  }'
```

The new branch needs a compute endpoint before you can connect to it. Copy
its **direct** connection string from the Console (or the API response) and
point staging/verification at that branch.

Then point a **staging** backend at the drill branch (or run the verification
script directly against its direct connection string) and run §5.

Delete the drill branch when the evidence is recorded.

### 3.2 Real recovery (overwrites the branch)

Neon instant restore **overwrites all databases on the selected root branch**
and temporarily interrupts connections. It also creates an automatic backup
branch named `{branch}_old_{timestamp}` so you can undo the restore.

1. Use Time Travel Assist to query the target timestamp read-only and confirm it
   is the right moment.
2. **Postgres database → Backup & Restore → Restore from history**.
3. Choose the timestamp/LSN, review the summary, and restore.
4. Existing connections reconnect automatically; the connection string does not
   change.
5. Run §5 immediately.
6. If the restore was wrong, restore again from the automatic backup branch.

Limitations:

- Instant restore works on **root branches** only. Child branches and branches
  created from snapshots do not support it.
- All databases on the branch are restored, not just `neondb`.
- Cloudinary assets are not part of the timeline.

---

## 4. Off-platform copy: logical dump

Use a logical dump when you need a copy outside Neon: compliance, a provider
move, or protection against a deleted project or expired history window.

### 4.1 Prerequisites

- PostgreSQL client tools matching the server major version. The current server
  is **PostgreSQL 18.x**, so install `pg_dump`/`pg_restore` 18.x.
- The **direct** (unpooled) Neon connection string. Do not dump over the
  `-pooler` endpoint.
- `DIRECT_URL` in `backend/.env` (or exported in the shell).
- Enough local disk space; dumps are written to `backend/backups/` by default.

Ubuntu/Debian:

```bash
sudo apt-get install postgresql-client-18
```

Arch Linux:

```bash
sudo pacman -S postgresql
```

macOS:

```bash
brew install postgresql@18
```

Verify:

```bash
pg_dump --version
pg_restore --version
```

### 4.2 Create a backup

From `backend/`:

```bash
pnpm db:backup
```

The script:

- refuses a pooled URL,
- writes a custom-format dump to `backups/plateflow-<UTC timestamp>.dump`,
- restricts the directory to mode `700`,
- prints the byte size and SHA-256.

Equivalent manual command:

```bash
pg_dump -Fc --no-owner --no-privileges \
  --dbname="$DIRECT_URL" \
  --file="backups/plateflow-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Immediately:

1. Move the dump off the app host (encrypted object storage, or an encrypted
   volume).
2. Encrypt at rest if the storage does not do it for you (`age`, GPG, or
   provider-side SSE). Dumps contain password hashes and customer data.
3. Record the checksum in the drill log.
4. Apply retention: keep at least 7 daily copies and 4 weekly copies, or the
   policy your customers/regulations require.

### 4.3 Restore a logical dump

Always restore into a **fresh Neon branch/database**, then verify.

```bash
# 1. Create an empty target branch/database in Neon and copy its DIRECT url.
# 2. Restore with the explicit target URL.
RESTORE_TARGET_URL="postgresql://...direct..." \
  pnpm db:restore -- ./backups/plateflow-20261107T120000Z.dump --yes

# 3. Verify before switching anything.
RESTORE_VERIFY_URL="postgresql://...direct..." \
  pnpm db:verify-restore
```

The restore script:

- requires `RESTORE_TARGET_URL` (never infers it from `DATABASE_URL`),
- rejects a pooled URL,
- refuses the same host/database as `DIRECT_URL` unless
  `ALLOW_RESTORE_OVER_SOURCE=1` is set intentionally,
- requires `--yes` because `pg_restore --clean --if-exists` drops existing
  objects,
- uses `--no-owner --no-privileges` so the restore does not depend on matching
  database roles.

If `pg_restore` reports errors, **do not switch traffic**. Delete the target
branch, create a fresh one, and retry after reading the output.

### 4.4 Scratch-database drill variant

When a separate Neon branch is not available, a drill can restore into a scratch
database on the same branch. This is for drills only; production recovery should
use a branch so the damaged timeline stays untouched.

```bash
# 1. Create an empty scratch database (requires CREATEDB).
psql "$DIRECT_URL" -c 'CREATE DATABASE plateflow_drill_20261107'

# 2. Point the rest of the URL at the new database.
RESTORE_TARGET_URL="postgresql://.../plateflow_drill_20261107?sslmode=require" \
  pnpm db:restore -- ./backups/plateflow-....dump --yes

RESTORE_VERIFY_URL="postgresql://.../plateflow_drill_20261107?sslmode=require" \
  pnpm db:verify-restore

# 3. Drop it after recording evidence.
psql "$DIRECT_URL" -c 'DROP DATABASE plateflow_drill_20261107'
```

`db:restore` compares host + database, so restoring into a different database on
the same host is allowed; restoring over the source is not.

---

## 5. Verify a restore

Run against the restored branch:

```bash
RESTORE_VERIFY_URL="postgresql://...direct..." pnpm db:verify-restore
```

The script checks:

- every Prisma migration has a `finished_at` (no half-applied migration),
- `restaurantId` is still `NOT NULL` on `User`, `MenuCategory`, `MenuItem`,
  `Table`, and `Order`,
- at least one `Restaurant` exists,
- no tenant-owned row points at a missing restaurant,
- no `OrderItem` points at a missing order,
- no `MenuItemSize` points at a missing menu item,
- prints a row count for every table in the backup contract.

It exits non-zero on any failure and is read-only.

Also compare against the source before switching:

```sql
SELECT count(*) FROM "Restaurant";
SELECT count(*) FROM "User";
SELECT count(*) FROM "MenuItem";
SELECT count(*) FROM "Table";
SELECT count(*) FROM "Order";
SELECT count(*) FROM "OrderItem";
```

Spot-check one known row (for example, a recent order id) and confirm its items
and status match the source. The script's row counts are the minimum evidence;
a spot check catches a dump that restored the wrong day.

---

## 6. Drill procedure (recorded evidence)

Run this quarterly, before the first production launch, and before any risky
migration.

1. Announce the drill; use staging or a scratch branch. Do not restore over
   production.
2. Record the start time (UTC).
3. Choose a restore point 10–15 minutes in the past.
4. Create a Neon branch from that timestamp, or restore the latest logical dump
   into a fresh branch.
5. Point a staging backend at the branch, or run `db:verify-restore` directly
   against its direct URL.
6. Run §5. Record the row counts and any spot-check.
7. Measure the time from “start” to “verification passed” — that is the RTO.
8. Confirm the source database was not modified.
9. Delete the scratch branch and any temporary dump copies.
10. Record the result below and fix anything that made the drill slower or
    ambiguous.

### 6.1 Drill log

Record each run in [Drill log](./DRILL-LOG.md). The first entry (2026-11-07)
is a completed logical dump → scratch database drill. Use the template below
for a new entry.

```text
Drill date (UTC):
Operator:
Source:                 production / staging (branch:            )
Target:                 Neon branch / logical dump (name:       )
Restore point:          timestamp / LSN / dump file
Start time:
Verification passed:    yes / no
RTO:
Row counts:             Restaurant=  User=  MenuCategory=  MenuItem=
                        MenuItemSize=  Table=  Order=  OrderItem=
                        RefreshToken=  VerificationToken=
Spot check:             order id / expected status / result
Issues:
Follow-ups:
```

---

## 7. Real disaster recovery

Use this when production data is lost or corrupted beyond a quick branch
restore.

1. Stop writes if possible: put the app in maintenance or scale the backend to
   zero so the old data cannot be overwritten further.
2. Pick the newest verified restore point that predates the incident.
3. Restore into a new Neon branch (PITR or logical dump). Do not overwrite the
   damaged production branch until the restore is verified; keep it for
   forensics.
4. Run `db:verify-restore` and the spot check from §5.
5. Update Render `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) to the
   verified branch and redeploy/restart.
6. Rotate `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` so any sessions
   created after the restore point are invalidated.
7. Run the smoke tests in the deploy runbook.
8. Tell affected restaurants what happened, what window was lost, and when the
   service was restored.
9. Record the incident and schedule a follow-up drill.

---

## 8. Security and retention

- Dumps contain password hashes, emails, and order history. Encrypt at rest and
  restrict access to the operator group.
- Never paste a connection string into a ticket, chat, or log. The scripts print
  only `host/database`.
- Delete temporary drill branches and dump copies after recording evidence.
- Keep the Neon API key and object-storage credentials out of the repo; use the
  secret inventory.
- Verify the restore target host/database before running `pg_restore`; the
  script requires `--yes` and refuses the source database by default.
- Test that a dump can actually be restored, not just that it exists. An
  unreadable backup is not a backup.

---

## 9. Known limitations

- Logical dumps are a point-in-time snapshot; anything written after the dump
  starts is not included. Use Neon PITR for near-zero RPO.
- `pg_dump`/`pg_restore` must match the server major version; an old client can
  fail against PostgreSQL 18.
- Pooled connection strings break session-level dump/restore behavior. Always
  use the direct URL.
- Cloudinary assets and Resend history are outside the database backup.
- Neon instant restore applies to the whole branch, not one database.
