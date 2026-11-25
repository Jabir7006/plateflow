import { describe, expect, it } from "vitest";
import { createCIEnvironment } from "../../../scripts/ci-env.js";

const input = { GITHUB_ACTIONS: "true", CI_POSTGRES_PASSWORD: "test-run-1" };

describe("CI environment isolation", () => {
  it.each([undefined, "false"])(
    "refuses setup outside Actions (%s)",
    (value) => {
      expect(() =>
        createCIEnvironment({ ...input, GITHUB_ACTIONS: value })
      ).toThrow("requires GitHub Actions");
    }
  );

  it.each([undefined, "", "line\nbreak", "line\rbreak"])(
    "rejects a missing or multiline service credential",
    (value) => {
      expect(() =>
        createCIEnvironment({ ...input, CI_POSTGRES_PASSWORD: value })
      ).toThrow("single-line");
    }
  );

  it.each(["0", "65536", "1.5", "-1", "invalid"])(
    "rejects invalid port %s",
    (port) => {
      expect(() =>
        createCIEnvironment({ ...input, CI_DATABASE_PORT: port })
      ).toThrow("TCP port");
    }
  );

  it("overrides inherited database/provider settings with the job's loopback database", () => {
    const env = createCIEnvironment({
      ...input,
      CI_POSTGRES_PASSWORD: "run/id%@attempt",
      CI_DATABASE_PORT: "5439",
      DATABASE_URL: "inherited-database-target",
      DIRECT_URL: "inherited-direct-target",
      TEST_DATABASE_URL: "inherited-test-target",
      RESEND_API_KEY: "inherited-provider-key",
    });
    const url = new URL(env.DATABASE_URL);
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.port).toBe("5439");
    expect(url.pathname).toBe("/plateflow_ci");
    expect(url.username).toBe("plateflow_ci");
    expect(decodeURIComponent(url.password)).toBe("run/id%@attempt");
    expect(env.DIRECT_URL).toBe(env.DATABASE_URL);
    expect(env.TEST_DATABASE_URL).toBe(env.DATABASE_URL);
    expect(env.RESEND_API_KEY).not.toBe("inherited-provider-key");
  });

  it("makes independent credentials and matching image configuration for builds", () => {
    const first = createCIEnvironment(input);
    const second = createCIEnvironment(input);
    expect(first.ACCESS_TOKEN_SECRET).toHaveLength(64);
    expect(first.ACCESS_TOKEN_SECRET).not.toBe(first.REFRESH_TOKEN_SECRET);
    expect(first.ACCESS_TOKEN_SECRET).not.toBe(second.ACCESS_TOKEN_SECRET);
    expect(first.SEED_MANAGER_PASSWORD).toHaveLength(64);
    expect(first.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME).toBe(
      first.CLOUDINARY_CLOUD_NAME
    );
    expect(first.RESEND_API_KEY).toMatch(/^re_ci_/);
    expect(first).not.toHaveProperty("NODE_ENV"); // Next builds choose production themselves.
  });
});
