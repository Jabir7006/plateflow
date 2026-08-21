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

async function main() {
  await prisma.user.upsert({
    where: { email: SEED_MANAGER_EMAIL },
    update: {},
    create: {
      fullName: "Jabir Ahmad",
      email: SEED_MANAGER_EMAIL,
      password: await hashPassword(SEED_MANAGER_PASSWORD),
      role: "MANAGER",
      status: "ACTIVE",
    },
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
