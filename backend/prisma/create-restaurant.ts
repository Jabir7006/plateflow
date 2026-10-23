import "dotenv/config";
import { Pool } from "pg";
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";
import { PrismaClient, Prisma } from "../src/generated/prisma/client.js";
import { hashValue as hashPassword } from "../src/utils/bcrypt.js";

// Admin-provisions a restaurant and its first OWNER. The password never rides a
// command-line argument (that leaks it into shell history and `ps`): it is read
// from PLATEFLOW_OWNER_PASSWORD, or stdin when the env var is absent, or a
// password file via --owner-password-file.
//
//   tsx prisma/create-restaurant.ts \
//     --name "Spice Garden" --slug spice-garden \
//     --owner-name "Asha Rahman" --owner-email asha@spicegarden.com
//
//   PLATEFLOW_OWNER_PASSWORD=... tsx prisma/create-restaurant.ts --help

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const USAGE = `Create a restaurant and its first OWNER.

Usage:
  tsx prisma/create-restaurant.ts --name <name> --slug <slug> \\
      --owner-name <full name> --owner-email <email> [--owner-password-file <path>]

Options:
  --name                  Restaurant display name (required)
  --slug                  URL-safe slug, e.g. spice-garden (required)
  --owner-name            Owner's full name (required)
  --owner-email           Owner's email, used to log in (required)
  --owner-password-file   Read the password from a file instead of stdin
  -h, --help              Show this help

The owner password is read from PLATEFLOW_OWNER_PASSWORD, else a line from
stdin, else --owner-password-file. It is never accepted as a command-line value.
`;

function fail(message: string): never {
  throw new Error(message);
}

async function readOwnerPassword(filePath?: string): Promise<string> {
  if (filePath) {
    const password = (await readFile(filePath, "utf8")).replace(/\s+$/, "");
    if (!password) fail("The password file is empty");
    return password;
  }

  const fromEnv = process.env.PLATEFLOW_OWNER_PASSWORD?.trim();
  if (fromEnv) return fromEnv;

  // No env var: prompt on stdin (no echo). Falls back to a plain read when
  // stdin isn't a TTY (e.g. piping the password in).
  const readline = await import("node:readline/promises");
  const input = process.stdin;
  const rl = readline.createInterface({ input, terminal: input.isTTY });
  try {
    const password = await rl.question("Owner password: ");
    return password;
  } finally {
    rl.close();
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: "string" },
      slug: { type: "string" },
      "owner-name": { type: "string" },
      "owner-email": { type: "string" },
      "owner-password-file": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    console.log(USAGE);
    return;
  }

  const name = values["name"]?.trim();
  const slug = values["slug"]?.trim().toLowerCase();
  const ownerName = values["owner-name"]?.trim();
  const ownerEmail = values["owner-email"]?.trim().toLowerCase();
  const ownerPasswordFile = values["owner-password-file"];

  if (!name) fail("--name is required");
  if (!slug) fail("--slug is required");
  if (!SLUG_PATTERN.test(slug))
    fail(
      '--slug must be lowercase letters, numbers and hyphens (e.g. "spice-garden")'
    );
  if (!ownerName) fail("--owner-name is required");
  if (!ownerEmail) fail("--owner-email is required");
  if (!z.email().safeParse(ownerEmail).success)
    fail("--owner-email must be a valid email address");

  const ownerPassword = await readOwnerPassword(ownerPasswordFile);
  if (ownerPassword.length < 8)
    fail("The owner password must be at least 8 characters");
  // bcrypt ignores everything after the first 72 bytes.
  if (Buffer.byteLength(ownerPassword, "utf8") > 72)
    fail("The owner password must not exceed 72 UTF-8 bytes");

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) fail("DATABASE_URL is required");

  const passwordHash = await hashPassword(ownerPassword);
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const { restaurant, owner } = await prisma
      .$transaction(async (tx) => {
        const restaurant = await tx.restaurant.create({ data: { name, slug } });
        const owner = await tx.user.create({
          data: {
            fullName: ownerName,
            email: ownerEmail,
            password: passwordHash,
            role: "OWNER",
            status: "ACTIVE",
            restaurantId: restaurant.id,
          },
        });
        return { restaurant, owner };
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const target = String(
            Array.isArray(error.meta?.target)
              ? error.meta.target.join(",")
              : (error.meta?.target ?? "")
          );
          if (target.includes("email"))
            fail(`A user with email "${ownerEmail}" already exists`);
          if (target.includes("slug"))
            fail(`A restaurant with slug "${slug}" already exists`);
          fail("A unique constraint was violated");
        }
        throw error;
      });

    console.log(
      `\n  ✓ Created restaurant "${restaurant.name}" (slug: ${restaurant.slug})` +
        `\n    Owner: ${owner.fullName} <${owner.email}>\n`
    );
  } finally {
    try {
      await prisma.$disconnect();
    } finally {
      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    `\n  ✗ ${error instanceof Error ? error.message : "Failed to create restaurant"}\n`
  );
  process.exitCode = 1;
});
