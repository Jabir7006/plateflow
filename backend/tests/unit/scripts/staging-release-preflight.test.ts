import { describe, expect, it, vi } from "vitest";
import { verifyStagingRelease } from "../../../scripts/lib/staging-release-preflight.js";
import {
  CI_RUN_URL,
  DB_PASSWORD,
  NEON_TOKEN,
  OTHER_SHA,
  POOLED_HOST,
  PRODUCTION_HOST,
  RENDER_TOKEN,
  SHA,
  STAGING_HOST,
  databaseUrl,
  envVar,
  preflightReplies,
  type Reply,
} from "../../fixtures/staging-release-preflight.js";

function run(
  replies: Reply[],
  respond = (reply: Reply) => Response.json(reply.body)
) {
  let index = 0;
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const reply = replies[index++];
    expect(String(input)).toBe(reply.url);
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init?.headers).get("authorization")).toBe(
      reply.token ? `Bearer ${reply.token}` : null
    );
    return respond(reply);
  });
  const result = verifyStagingRelease({
    sha: SHA,
    fetch,
    renderApiKey: RENDER_TOKEN,
    neonApiKey: NEON_TOKEN,
  });
  return { fetch, result };
}

describe("staging release preflight", () => {
  it("checks the exact successful master push attempt, both hosts, and master again", async () => {
    const replies = Object.values(preflightReplies());
    const { fetch, result } = run(replies);
    await expect(result).resolves.toEqual({ sha: SHA, ciRunUrl: CI_RUN_URL });
    expect(fetch).toHaveBeenCalledTimes(replies.length);
  });

  it("stops for a stale SHA before fetching CI", async () => {
    const replies = preflightReplies();
    replies.master.body.object.sha = OTHER_SHA;
    const { fetch, result } = run(Object.values(replies));
    await expect(result).rejects.toThrow(
      "GitHub SHA is not the current master tip"
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fails if master advances during preflight", async () => {
    const replies = preflightReplies();
    replies.masterRecheck.body.object.sha = OTHER_SHA;
    await expect(run(Object.values(replies)).result).rejects.toThrow(
      "GitHub master moved during preflight"
    );
  });

  it("rejects a missing push run", async () => {
    const replies = preflightReplies();
    replies.ci.body.workflow_runs = [];
    const { fetch, result } = run(Object.values(replies));
    await expect(result).rejects.toThrow("GitHub has no CI push run");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["another SHA", { head_sha: OTHER_SHA }, "GitHub has no CI push run"],
    ["another branch", { head_branch: "other" }, "GitHub has no CI push run"],
    ["another event", { event: "pull_request" }, "GitHub has no CI push run"],
    [
      "in progress",
      { status: "in_progress", conclusion: null },
      "must complete successfully",
    ],
    ["failed", { conclusion: "failure" }, "must complete successfully"],
    [
      "non-numeric ID",
      { id: "1234/another-path" },
      "unexpected response format",
    ],
    [
      "unsafe run attempt",
      { run_attempt: Number.MAX_SAFE_INTEGER + 1 },
      "unexpected response format",
    ],
  ])(
    "stops before providers when the push run is %s",
    async (_label, change, message) => {
      const replies = preflightReplies();
      Object.assign(replies.ci.body.workflow_runs[0], change);
      const { fetch, result } = run(Object.values(replies));
      await expect(result).rejects.toThrow(message);
      expect(fetch).toHaveBeenCalledTimes(2);
    }
  );

  it.each([
    ["missing", { name: "another job" }],
    ["skipped", { conclusion: "skipped" }],
    ["queued", { status: "queued", conclusion: null }],
    ["for another SHA", { head_sha: OTHER_SHA }],
  ])("rejects a latest attempt with CI %s", async (_label, change) => {
    const replies = preflightReplies();
    Object.assign(replies.jobs.body.jobs[0], change);
    const { fetch, result } = run(Object.values(replies));
    await expect(result).rejects.toThrow("must have one successful CI job");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rejects an incomplete job response", async () => {
    const replies = preflightReplies();
    replies.jobs.body.total_count = 101;
    await expect(run(Object.values(replies)).result).rejects.toThrow(
      "must have one successful CI job"
    );
  });

  it.each([
    { id: "srv-other" },
    { name: "another-api" },
    { branch: "dev" },
    { autoDeploy: "yes" },
  ])("rejects mismatched Render service metadata", async (change) => {
    const replies = preflightReplies();
    Object.assign(replies.service.body, change);
    const { fetch, result } = run(Object.values(replies));
    await expect(result).rejects.toThrow(
      "Render must report the staging API on master with auto-deploy off"
    );
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("requires both Render entries and rejects duplicates", async () => {
    const replies = preflightReplies();
    const direct = replies.vars.body.pop()!;
    await expect(run(Object.values(replies)).result).rejects.toThrow(
      "DIRECT_URL is missing or empty"
    );
    replies.vars.body.push(direct, direct);
    await expect(run(Object.values(replies)).result).rejects.toThrow(
      "duplicate DIRECT_URL"
    );
  });

  it("follows Render and Neon cursor pages on their original origins", async () => {
    const {
      master,
      ci,
      jobs,
      service,
      vars,
      branch,
      endpoints,
      masterRecheck,
    } = preflightReplies();
    const cursor = "next +/=";
    const encoded = "next+%2B%2F%3D";
    const fullPage = [
      vars.body[0],
      ...Array.from({ length: 99 }, (_, i) =>
        envVar(`other-${i}`, "example", cursor)
      ),
    ];
    const result = run([
      master,
      ci,
      jobs,
      service,
      { ...vars, body: fullPage },
      { ...vars, url: `${vars.url}&cursor=${encoded}`, body: [vars.body[1]] },
      branch,
      { ...endpoints, body: { endpoints: [], pagination: { cursor } } },
      { ...endpoints, url: `${endpoints.url}?cursor=${encoded}` },
      masterRecheck,
    ]).result;
    await expect(result).resolves.toEqual({ sha: SHA, ciRunUrl: CI_RUN_URL });
  });

  it("checks for a duplicate Render entry across pages", async () => {
    const { master, ci, jobs, service, vars } = preflightReplies();
    const firstPage = [
      ...vars.body,
      ...Array.from({ length: 98 }, (_, i) => envVar(`other-${i}`, "example")),
    ];
    const { result } = run([
      master,
      ci,
      jobs,
      service,
      { ...vars, body: firstPage },
      {
        ...vars,
        url: `${vars.url}&cursor=example-cursor`,
        body: [vars.body[1]],
      },
    ]);
    await expect(result).rejects.toThrow("duplicate DIRECT_URL");
  });

  it("rejects repeated Render pagination cursors", async () => {
    const { master, ci, jobs, service, vars } = preflightReplies();
    const fullPage = Array.from({ length: 100 }, (_, i) =>
      envVar(`other-${i}`, "example")
    );
    const { result } = run([
      master,
      ci,
      jobs,
      service,
      { ...vars, body: fullPage },
      { ...vars, url: `${vars.url}&cursor=example-cursor`, body: fullPage },
    ]);
    await expect(result).rejects.toThrow(
      "Render staging env vars: missing or repeated pagination cursor"
    );
  });

  it("rejects repeated Neon pagination cursors", async () => {
    const { master, ci, jobs, service, vars, branch, endpoints } =
      preflightReplies();
    const firstPage = {
      ...endpoints,
      body: { endpoints: [], pagination: { cursor: "repeated" } },
    };
    const { result } = run([
      master,
      ci,
      jobs,
      service,
      vars,
      branch,
      firstPage,
      { ...firstPage, url: `${endpoints.url}?cursor=repeated` },
    ]);
    await expect(result).rejects.toThrow(
      "Neon project endpoints: repeated pagination cursor"
    );
  });

  it.each([
    ["production direct", POOLED_HOST, PRODUCTION_HOST, "Render DIRECT_URL"],
    ["swapped roles", STAGING_HOST, POOLED_HOST, "Render DIRECT_URL"],
    ["lost pooling", STAGING_HOST, STAGING_HOST, "Render DATABASE_URL"],
    [
      "different staging endpoints",
      "ep-other-pooler.synthetic.neon.tech",
      STAGING_HOST,
      "Render DATABASE_URL",
    ],
  ])(
    "rejects %s despite successful CI",
    async (_label, pooled, direct, message) => {
      const replies = preflightReplies();
      replies.vars.body[0].envVar.value = databaseUrl(pooled);
      replies.vars.body[1].envVar.value = databaseUrl(direct);
      replies.endpoints.body.endpoints.push({
        ...replies.endpoints.body.endpoints[0],
        host: "ep-other.synthetic.neon.tech",
      });
      await expect(run(Object.values(replies)).result).rejects.toThrow(message);
    }
  );

  it.each([
    [DB_PASSWORD, "must be a valid PostgreSQL URL"],
    [
      databaseUrl(STAGING_HOST).replace("postgresql", "https"),
      "must be a valid PostgreSQL URL",
    ],
    [
      databaseUrl(STAGING_HOST).replace("/neondb", "/other/../neondb"),
      "must be a valid PostgreSQL URL",
    ],
    [
      databaseUrl(STAGING_HOST).replace("/neondb", "/wrong-db"),
      "must use neondb on port 5432",
    ],
    [databaseUrl(`${STAGING_HOST}:5433`), "must use neondb on port 5432"],
  ])(
    "rejects an invalid database URL, database path, or port",
    async (url, message) => {
      const replies = preflightReplies();
      replies.vars.body[1].envVar.value = url;
      await expect(run(Object.values(replies)).result).rejects.toThrow(
        `Render DIRECT_URL ${message}`
      );
    }
  );

  it.each([
    "%48oST",
    "hostaddr",
    "port",
    "database",
    "dbname",
    "options",
    "user",
    "password",
    "service",
  ])("rejects the %s connection override", async (param) => {
    const replies = preflightReplies();
    replies.vars.body[1].envVar.value += `&${param}=${DB_PASSWORD}`;
    await expect(run(Object.values(replies)).result).rejects.toThrow(
      /^Render DIRECT_URL contains a connection override$/
    );
  });

  it.each([
    { default: true },
    { name: "production" },
    { id: "br-other" },
    { project_id: "another-project" },
  ])("rejects unexpected Neon branch metadata", async (change) => {
    const replies = preflightReplies();
    Object.assign(replies.branch.body.branch, change);
    const { fetch, result } = run(Object.values(replies));
    await expect(result).rejects.toThrow(
      "Neon must report the expected non-default staging branch"
    );
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it.each([
    { disabled: true },
    { type: "read_only" },
    { branch_id: "br-production" },
    { project_id: "another-project" },
  ])(
    "rejects an endpoint outside the writable staging target",
    async (change) => {
      const replies = preflightReplies();
      Object.assign(replies.endpoints.body.endpoints[0], change);
      await expect(run(Object.values(replies)).result).rejects.toThrow(
        "Render DIRECT_URL must use the direct host"
      );
    }
  );

  it("accepts the explicit default database port", async () => {
    const replies = preflightReplies();
    replies.vars.body[1].envVar.value = databaseUrl(`${STAGING_HOST}:5432`);
    await expect(run(Object.values(replies)).result).resolves.toEqual({
      sha: SHA,
      ciRunUrl: CI_RUN_URL,
    });
  });

  it.each([
    [() => new Response(RENDER_TOKEN, { status: 403 }), "HTTP 403"],
    [() => new Response(RENDER_TOKEN, { status: 302 }), "HTTP 302"],
    [() => new Response(RENDER_TOKEN), "could not read JSON response"],
    [
      () => Response.json({ error: RENDER_TOKEN }),
      "unexpected response format",
    ],
    [
      () => {
        throw new Error(RENDER_TOKEN);
      },
      "request failed or timed out",
    ],
  ] as const)(
    "sanitizes Render transport and response failures",
    async (failure, message) => {
      const replies = preflightReplies();
      const { fetch, result } = run(Object.values(replies), (reply) =>
        reply === replies.service ? failure() : Response.json(reply.body)
      );
      await expect(result).rejects.toThrow(
        new Error(`Render staging service: ${message}`)
      );
      expect(fetch).toHaveBeenCalledTimes(4);
    }
  );
});
