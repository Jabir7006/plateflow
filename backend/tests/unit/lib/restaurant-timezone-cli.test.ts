import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("restaurant timezone provisioning", () => {
  it.each([
    [[], "--timezone is required"],
    [["--timezone", "Mars/City"], "valid named IANA timezone"],
    [["--timezone", "+06:00"], "valid named IANA timezone"],
  ])(
    "rejects missing/invalid timezone before asking for a password or writing data: %s",
    (extra, message) => {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "prisma/create-restaurant.ts",
          "--name",
          "Timezone Test",
          "--slug",
          "timezone-test",
          ...extra,
        ],
        {
          encoding: "utf8",
          timeout: 10_000,
          env: {
            ...process.env,
            DATABASE_URL: "postgresql://unit:unit@127.0.0.1:5432/unit",
          },
        }
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(message);
      expect(result.stdout).not.toContain("Owner password");
    }
  );
});
