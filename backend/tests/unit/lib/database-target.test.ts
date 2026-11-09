import { describe, expect, it } from "vitest";
import {
  describeTarget,
  parseDatabaseTarget,
  requireDirectTarget,
} from "../../../scripts/lib/database-target.js";

const direct =
  "postgresql://user:secret@ep-cool-waterfall-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const pooled =
  "postgresql://user:secret@ep-cool-waterfall-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

describe("parseDatabaseTarget", () => {
  it("extracts the host and database without exposing credentials", () => {
    const target = parseDatabaseTarget(direct);

    expect(target.host).toBe(
      "ep-cool-waterfall-123456.ap-southeast-1.aws.neon.tech"
    );
    expect(target.database).toBe("neondb");
    expect(target.pooled).toBe(false);
  });

  it("recognizes Neon's pooled endpoint", () => {
    expect(parseDatabaseTarget(pooled).pooled).toBe(true);
  });

  it("rejects non-postgres URLs", () => {
    expect(() => parseDatabaseTarget("https://example.com/db")).toThrow(
      "Expected a postgres connection string"
    );
  });

  it("rejects a URL without a database name", () => {
    expect(() => parseDatabaseTarget("postgresql://user:pass@host")).toThrow(
      "host and database"
    );
  });
});

describe("describeTarget", () => {
  it("never includes the password", () => {
    const description = describeTarget(direct);

    expect(description).not.toContain("secret");
    expect(description).toContain("neondb");
  });
});

describe("requireDirectTarget", () => {
  it("accepts an unpooled connection", () => {
    expect(() => requireDirectTarget(direct, "DIRECT_URL")).not.toThrow();
  });

  it("rejects a pooled connection for pg_dump/pg_restore", () => {
    expect(() => requireDirectTarget(pooled, "RESTORE_TARGET_URL")).toThrow(
      "RESTORE_TARGET_URL is a pooled connection"
    );
  });
});
