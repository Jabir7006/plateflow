import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CI_RUN_URL,
  NEON_TOKEN,
  PRODUCTION_HOST,
  RENDER_TOKEN,
  SHA,
  databaseUrl,
  preflightReplies,
  type Reply,
} from "../fixtures/staging-release-preflight.js";
import { BACKEND_ROOT } from "../harness.js";

const credentials = {
  PLATEFLOW_RENDER_API_KEY: RENDER_TOKEN,
  PLATEFLOW_NEON_API_KEY: NEON_TOKEN,
};

function run(
  args: string[],
  env: NodeJS.ProcessEnv = {},
  replies: Reply[] = []
) {
  const dir = mkdtempSync(join(tmpdir(), "plateflow-preflight-"));
  try {
    const preload = join(dir, "fixtures.mjs");
    writeFileSync(
      preload,
      `
      const replies = ${JSON.stringify(replies)};
      let index = 0;
      globalThis.fetch = async (url, init) => {
        const reply = replies[index++];
        if (!reply || String(url) !== reply.url || init.method !== "GET" ||
            new Headers(init.headers).get("Authorization") !==
              (reply.token ? "Bearer " + reply.token : null)) {
          process.stderr.write("Unexpected fetch request\\n");
          throw new Error("Invalid fixture request");
        }
        return Response.json(reply.body);
      };
      process.on("exit", () => {
        if (index !== replies.length) {
          process.stderr.write("Mismatch in fetch request count\\n");
          process.exitCode = 2;
        }
      });
    `
    );
    return spawnSync(
      process.execPath,
      [
        "--import",
        preload,
        "--import",
        "tsx",
        "scripts/staging-release-preflight.ts",
        ...args,
      ],
      {
        cwd: BACKEND_ROOT,
        env: { PATH: process.env.PATH, ...env },
        encoding: "utf8",
        timeout: 15_000,
      }
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("staging release preflight CLI", () => {
  it.each(
    [
      [],
      ["--sha"],
      ["--sha", "invalid"],
      ["--sha", SHA, "--sha", SHA],
      ["--sha", SHA, "--other"],
    ].map((args) => ({ args }))
  )(
    "requires exactly one full SHA before consulting credentials",
    ({ args }) => {
      const child = run(args);
      expect(child.status).toBe(1);
      expect(child.stdout).toBe("");
      expect(child.stderr).toBe(
        "Usage: pnpm --filter backend release:preflight:staging --sha <40-character master SHA>\n"
      );
    }
  );

  it.each([
    [{}, "PLATEFLOW_RENDER_API_KEY"],
    [{ PLATEFLOW_RENDER_API_KEY: RENDER_TOKEN }, "PLATEFLOW_NEON_API_KEY"],
  ] as const)(
    "requires both provider tokens before any request",
    (env, missing) => {
      const child = run(["--sha", SHA], env);
      expect(child.status).toBe(1);
      expect(child.stdout).toBe("");
      expect(child.stderr).toBe(
        `Set ${missing} through your private credential store\n`
      );
    }
  );

  it("normalizes the SHA and prints only the successful release evidence", () => {
    const child = run(
      ["--sha", SHA.toUpperCase()],
      credentials,
      Object.values(preflightReplies())
    );
    expect(child.status).toBe(0);
    expect(child.stderr).toBe("");
    expect(child.stdout).toBe(
      `Staging release preflight passed for ${SHA}\n${CI_RUN_URL}\n`
    );
  });

  it("rejects a production DIRECT_URL with one sanitized error", () => {
    const replies = preflightReplies();
    replies.vars.body[1].envVar.value = databaseUrl(PRODUCTION_HOST);
    const requests = Object.values(replies).filter(
      (reply) => reply !== replies.masterRecheck
    );
    const child = run(["--sha", SHA], credentials, requests);
    expect(child.status).toBe(1);
    expect(child.stdout).toBe("");
    expect(child.stderr).toBe(
      "Render DIRECT_URL must use the direct host of an enabled Neon staging read-write endpoint\n"
    );
  });
});
