import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { ENV } from "../src/config/env.js";
import { hashValue as hashPassword } from "../src/utils/bcrypt.js";

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const { SEED_MANAGER_EMAIL, SEED_MANAGER_PASSWORD } = ENV;
// Matches every other write path (create-restaurant.ts, shared auth schema):
// the email column is case-sensitive and globally unique, so an un-normalized
// value could create a duplicate account and bypass the cross-tenant guard.
const seedEmail = SEED_MANAGER_EMAIL.trim().toLowerCase();

async function main() {
  const passwordHash = await hashPassword(SEED_MANAGER_PASSWORD);

  await prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.upsert({
      where: { slug: "default" },
      update: {},
      create: { name: "My Restaurant", slug: "default" },
    });

    const owner = await tx.user.upsert({
      where: { email: seedEmail },
      update: { role: "OWNER" },
      create: {
        fullName: "Jabir Ahmad",
        email: seedEmail,
        password: passwordHash,
        role: "OWNER",
        status: "ACTIVE",
        restaurantId: restaurant.id,
      },
    });

    if (owner.restaurantId !== restaurant.id) {
      throw new Error("Seed owner email already belongs to another restaurant");
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
