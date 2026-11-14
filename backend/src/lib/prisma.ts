import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { ENV } from "../config/env.js";

const { DATABASE_URL, NODE_ENV } = ENV;

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
});

// Exported so shutdown can close the pool explicitly. Prisma's pg adapter does
// not own a pool passed to it, so prisma.$disconnect() alone leaves it open.
export { pool };

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
