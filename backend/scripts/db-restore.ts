import "dotenv/config";
import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  describeTarget,
  parseDatabaseTarget,
  requireDirectTarget,
} from "./lib/database-target.js";

// Restore a custom-format dump into an explicit target. The target is never
// inferred from DATABASE_URL: restoring over the wrong database is destructive
// and must be a deliberate act.
//
// Run from `backend/`:
//   RESTORE_TARGET_URL="postgresql://..." pnpm db:restore -- ./backups/file.dump --yes
//
// Always restore into a fresh Neon branch/database first, verify it with
// `pnpm db:verify-restore`, and only then switch production to it.

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const dumpPath = args.find((arg) => !arg.startsWith("--"));
const hasConfirmation = args.includes("--yes");

if (!dumpPath) {
  console.error(
    "Usage: RESTORE_TARGET_URL=... pnpm db:restore -- <dump-file> --yes"
  );
  process.exit(1);
}

if (!hasConfirmation) {
  console.error(
    "Refusing to restore without --yes. Check RESTORE_TARGET_URL first; " +
      "pg_restore --clean drops existing objects in that database."
  );
  process.exit(1);
}

const targetConnection = process.env.RESTORE_TARGET_URL?.trim();
if (!targetConnection) {
  console.error(
    "RESTORE_TARGET_URL is required and must point at the restore target."
  );
  process.exit(1);
}

try {
  requireDirectTarget(targetConnection, "RESTORE_TARGET_URL");
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const sourceConnection = process.env.DIRECT_URL?.trim();
if (sourceConnection) {
  const target = parseDatabaseTarget(targetConnection);
  const source = parseDatabaseTarget(sourceConnection);

  if (
    target.host === source.host &&
    target.database === source.database &&
    process.env.ALLOW_RESTORE_OVER_SOURCE !== "1"
  ) {
    console.error(
      "RESTORE_TARGET_URL points at the same database as DIRECT_URL. " +
        "Refusing to overwrite the live source. Restore into a fresh branch, " +
        "or set ALLOW_RESTORE_OVER_SOURCE=1 if this is an intentional recovery."
    );
    process.exit(1);
  }
}

const version = spawnSync("pg_restore", ["--version"], { encoding: "utf8" });
if (version.error || version.status !== 0) {
  console.error(
    "pg_restore was not found. Install PostgreSQL client tools (version 18.x " +
      "to match the current server) and try again."
  );
  process.exit(1);
}

const absoluteDump = resolve(dumpPath);
try {
  const { size } = await stat(absoluteDump);
  console.log(`Restoring ${absoluteDump} (${size} bytes)`);
} catch {
  console.error(`Dump file not found: ${absoluteDump}`);
  process.exit(1);
}

console.log(`Target: ${describeTarget(targetConnection)}`);

const result = spawnSync(
  "pg_restore",
  [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    `--dbname=${targetConnection}`,
    absoluteDump,
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  console.error(
    "pg_restore reported an error. Do not switch traffic to this target; " +
      "inspect the output and restore into a fresh branch again."
  );
  process.exit(result.status ?? 1);
}

console.log(
  "Restore finished. Verify before switching traffic:\n" +
    `  RESTORE_VERIFY_URL="<restored connection string>" pnpm db:verify-restore`
);
