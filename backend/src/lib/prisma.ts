import { Prisma, PrismaClient } from "../generated/prisma/client.js";
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

// Error logs go through an event callback instead of Prisma's stdout logger.
// A LogEvent contains only a message and target, and that message can embed the
// failing SQL and its values (including signup emails, tokens, or passwords).
// The callback records a fixed classification and target, never the message, so
// the Express handler remains the only place that can add redacted detail.
const log: Prisma.LogDefinition[] =
  NODE_ENV === "development"
    ? [
        { emit: "stdout", level: "query" },
        { emit: "stdout", level: "warn" },
        { emit: "event", level: "error" },
      ]
    : [{ emit: "event", level: "error" }];

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({ adapter, log });

  client.$on("error", (event) => {
    console.error("Prisma error", {
      target: event.target,
      classification: "prisma_error",
    });
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
