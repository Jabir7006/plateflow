import "dotenv/config";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, mkdir, stat, unlink } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { describeTarget, requireDirectTarget } from "./lib/database-target.js";

// Logical, off-platform backup. Neon's instant restore is the first line of
// recovery; this file is the portable copy that survives a deleted project,
// an expired history window, or a move to another provider.
//
// Run from `backend/`: `pnpm db:backup`
// Optional: `BACKUP_DIR=/secure/path pnpm db:backup`

const connectionString = process.env.DIRECT_URL?.trim();

if (!connectionString) {
  console.error(
    "DIRECT_URL is required (the unpooled Neon connection string)."
  );
  process.exit(1);
}

try {
  requireDirectTarget(connectionString, "DIRECT_URL");
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const version = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });
if (version.error || version.status !== 0) {
  console.error(
    "pg_dump was not found. Install PostgreSQL client tools (version 18.x " +
      "to match the current server) and try again."
  );
  process.exit(1);
}

const backupDir = resolve(process.env.BACKUP_DIR?.trim() || "backups");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dumpPath = resolve(backupDir, `plateflow-${stamp}.dump`);

await mkdir(backupDir, { recursive: true, mode: 0o700 });
await chmod(backupDir, 0o700);

console.log(`Backing up ${describeTarget(connectionString)} -> ${dumpPath}`);

const result = spawnSync(
  "pg_dump",
  [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    `--file=${dumpPath}`,
    `--dbname=${connectionString}`,
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  await unlink(dumpPath).catch(() => undefined);
  console.error("pg_dump failed; no usable backup was kept.");
  process.exit(result.status ?? 1);
}

const { size } = await stat(dumpPath);
const hash = createHash("sha256");

await new Promise<void>((resolveHash, rejectHash) => {
  const stream = createReadStream(dumpPath);
  stream.on("data", (chunk) => hash.update(chunk));
  stream.on("error", rejectHash);
  stream.on("end", resolveHash);
});

console.log(`Wrote ${basename(dumpPath)} (${size} bytes)`);
console.log(`sha256 ${hash.digest("hex")}`);
console.log(
  "Move this file off the app host, encrypt it at rest, and record the " +
    "checksum in the drill log."
);
