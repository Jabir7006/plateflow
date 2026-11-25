import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BACKEND_ROOT } from "../harness.js";

let scratch: string;
beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "plateflow-ci-env-"));
});
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function run(overrides: NodeJS.ProcessEnv = {}) {
  const file = join(scratch, "github-env");
  writeFileSync(file, "EXISTING_SETTING=kept\n", { mode: 0o600 });
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/ci-env.ts"],
    {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        GITHUB_ACTIONS: "true",
        CI_POSTGRES_PASSWORD: "test-run-1",
        CI_DATABASE_PORT: "5432",
        GITHUB_ENV: file,
        ...overrides,
      },
      encoding: "utf8",
      timeout: 15_000,
    }
  );
  return { child, text: readFileSync(file, "utf8") };
}

describe("CI environment command", () => {
  it("exports all DB targets together and emits mask commands without ordinary credential logs", () => {
    const { child, text } = run();
    expect(child.status).toBe(0);
    expect(text.startsWith("EXISTING_SETTING=kept\n")).toBe(true);
    const values = Object.fromEntries(
      text
        .trim()
        .split("\n")
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        })
    );
    expect(values.DATABASE_URL).toBe(values.DIRECT_URL);
    expect(values.DATABASE_URL).toBe(values.TEST_DATABASE_URL);
    expect(new URL(values.DATABASE_URL).hostname).toBe("127.0.0.1");
    expect(child.stdout).toContain(`::add-mask::${values.ACCESS_TOKEN_SECRET}`);
    const ordinaryLog = child.stdout
      .split("\n")
      .filter((line) => !line.startsWith("::add-mask::"))
      .join("\n");
    expect(ordinaryLog).not.toContain(values.DATABASE_URL);
    expect(ordinaryLog).not.toContain(values.ACCESS_TOKEN_SECRET);
    expect(ordinaryLog).not.toContain("test-run-1");
  });

  it.each([
    { GITHUB_ACTIONS: "false" },
    { CI_DATABASE_PORT: "65536" },
    { CI_POSTGRES_PASSWORD: "injected\nSETTING=value" },
    { GITHUB_ENV: undefined },
    { GITHUB_ENV: "relative-env-file" },
    { GITHUB_ENV: join(tmpdir(), "plateflow-missing-ci-env-file") },
  ])(
    "fails without changing the export file for invalid CI input",
    (overrides) => {
      const { child, text } = run(overrides);
      expect(child.status).toBe(1);
      expect(text).toBe("EXISTING_SETTING=kept\n");
      expect(child.stdout).not.toContain("::add-mask::");
    }
  );
});
