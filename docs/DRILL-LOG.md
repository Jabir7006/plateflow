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
  and complete; it does **not** exercise Neon branch creation or point-in-time
  restore.
- RTO excludes any provider-side branch/endpoint creation time. The Neon
  branch/PITR drill is still pending account access and must be recorded here
  when run.
- `pg_dump`/`pg_restore` were client version 18.6, matching the server major
  version.
