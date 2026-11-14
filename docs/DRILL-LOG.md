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
