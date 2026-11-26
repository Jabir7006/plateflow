import { z } from "zod";
import { parseDatabaseTarget } from "./database-target.js";

const GITHUB_REPO = "Jabir7006/plateflow";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}`;
const MASTER_REF = `${GITHUB_API}/git/ref/heads/master`;
const RENDER_SERVICE_ID = "srv-dc0hkk3m8hqs73ei58v0";
const RENDER_SERVICE = `https://api.render.com/v1/services/${RENDER_SERVICE_ID}`;
const RENDER_PAGE_SIZE = 100;
const NEON_PROJECT_ID = "billowing-flower-85802013";
const NEON_BRANCH_ID = "br-delicate-math-azov6qa2";
const NEON_PROJECT = `https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}`;

export const FULL_COMMIT_SHA = /^[a-f0-9]{40}$/i;

const shaSchema = z.string().regex(FULL_COMMIT_SHA);
const masterRefSchema = z.object({ object: z.object({ sha: shaSchema }) });
const completedCheckSchema = z.object({
  status: z.string(),
  conclusion: z.string().nullable(),
  head_sha: shaSchema,
});
const workflowRunsSchema = z.object({
  workflow_runs: z
    .array(
      completedCheckSchema.extend({
        id: z.int().positive(),
        run_attempt: z.int().positive(),
        event: z.string(),
        head_branch: z.string(),
      })
    )
    .max(1),
});
const jobsSchema = z.object({
  total_count: z.int().nonnegative(),
  jobs: z.array(completedCheckSchema.extend({ name: z.string() })),
});
const renderServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  branch: z.string(),
  autoDeploy: z.string(),
});
const renderEnvPageSchema = z
  .array(
    z.object({
      cursor: z.string().min(1).optional(),
      envVar: z.object({ key: z.string(), value: z.unknown() }),
    })
  )
  .max(RENDER_PAGE_SIZE);
const neonBranchSchema = z.object({
  branch: z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    default: z.boolean(),
  }),
});
const neonEndpointSchema = z.object({
  host: z.string().regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),
  project_id: z.string(),
  branch_id: z.string(),
  type: z.string(),
  disabled: z.boolean(),
});
const neonEndpointsSchema = z.object({
  endpoints: z.array(neonEndpointSchema),
  pagination: z.object({ cursor: z.string().min(1).nullish() }).nullish(),
});

const DATABASE_KEYS = ["DATABASE_URL", "DIRECT_URL"] as const;
type DatabaseKey = (typeof DATABASE_KEYS)[number];
const connectionOverrides = new Set([
  "host",
  "hostaddr",
  "port",
  "database",
  "dbname",
  "options",
  "user",
  "password",
  "service",
]);

export class StagingPreflightError extends Error {}

async function getJson<T>(
  fetch: typeof globalThis.fetch,
  url: string | URL,
  check: string,
  schema: z.ZodType<T>,
  token?: string
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new StagingPreflightError(`${check}: request failed or timed out`);
  }
  if (!response.ok) {
    throw new StagingPreflightError(`${check}: HTTP ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new StagingPreflightError(`${check}: could not read JSON response`);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new StagingPreflightError(`${check}: unexpected response format`);
  }
  return parsed.data;
}

async function verifyMasterCI(fetch: typeof globalThis.fetch, sha: string) {
  const { object } = await getJson(
    fetch,
    MASTER_REF,
    "GitHub master ref",
    masterRefSchema
  );
  if (object.sha !== sha) {
    throw new StagingPreflightError(
      "GitHub SHA is not the current master tip. Use the current master SHA after CI passes"
    );
  }

  const runUrl = new URL(`${GITHUB_API}/actions/workflows/ci.yml/runs`);
  runUrl.search = new URLSearchParams({
    branch: "master",
    event: "push",
    head_sha: sha,
    per_page: "1",
  }).toString();
  const {
    workflow_runs: [run],
  } = await getJson(fetch, runUrl, "GitHub master push CI", workflowRunsSchema);
  if (
    run?.head_sha !== sha ||
    run.head_branch !== "master" ||
    run.event !== "push"
  ) {
    throw new StagingPreflightError(
      "GitHub has no CI push run for this master SHA"
    );
  }
  if (run.status !== "completed" || run.conclusion !== "success") {
    throw new StagingPreflightError(
      "GitHub CI push run must complete successfully"
    );
  }

  const { jobs, total_count } = await getJson(
    fetch,
    `${GITHUB_API}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
    "GitHub CI attempt jobs",
    jobsSchema
  );
  const [job, duplicate] = jobs.filter(({ name }) => name === "CI");
  if (
    jobs.length !== total_count ||
    duplicate ||
    job?.head_sha !== sha ||
    job.status !== "completed" ||
    job.conclusion !== "success"
  ) {
    throw new StagingPreflightError(
      "GitHub latest run attempt must have one successful CI job for this SHA"
    );
  }
  return `https://github.com/${GITHUB_REPO}/actions/runs/${run.id}`;
}

async function readRenderDatabaseHosts(
  fetch: typeof globalThis.fetch,
  token: string
) {
  const service = await getJson(
    fetch,
    RENDER_SERVICE,
    "Render staging service",
    renderServiceSchema,
    token
  );
  if (
    service.id !== RENDER_SERVICE_ID ||
    service.name !== "plateflow-staging-api" ||
    service.branch !== "master" ||
    service.autoDeploy !== "no"
  ) {
    throw new StagingPreflightError(
      "Render must report the staging API on master with auto-deploy off"
    );
  }

  const url = new URL(`${RENDER_SERVICE}/env-vars?limit=${RENDER_PAGE_SIZE}`);
  const check = "Render staging env vars";
  const cursors = new Set<string>();
  const values = new Map<string, unknown>();
  for (;;) {
    const page = await getJson(fetch, url, check, renderEnvPageSchema, token);
    for (const {
      envVar: { key, value },
    } of page) {
      if (key !== "DATABASE_URL" && key !== "DIRECT_URL") continue;
      if (values.has(key)) {
        throw new StagingPreflightError(`${check}: duplicate ${key}`);
      }
      values.set(key, value);
    }
    if (page.length < RENDER_PAGE_SIZE) break;
    const cursor = page.at(-1)?.cursor;
    if (!cursor || cursors.has(cursor)) {
      throw new StagingPreflightError(
        `${check}: missing or repeated pagination cursor`
      );
    }
    cursors.add(cursor);
    url.searchParams.set("cursor", cursor);
  }

  const [pooled, direct] = DATABASE_KEYS.map((key) =>
    readDatabaseHost(values.get(key), key)
  );
  return { pooled, direct };
}

function readDatabaseHost(value: unknown, key: DatabaseKey): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new StagingPreflightError(
      `Render staging env vars: ${key} is missing or empty`
    );
  }

  let url: URL;
  let target: ReturnType<typeof parseDatabaseTarget>;
  try {
    // Require one literal database path segment so URL normalization cannot
    // turn a different path into the expected database name.
    if (
      /\s/.test(value) ||
      !/^postgres(?:ql)?:\/\/(?:[^@/?#]+@)?[^@/?#]+\/[^/?#]+(?:\?[^#]*)?$/i.test(
        value
      )
    ) {
      throw new Error();
    }
    url = new URL(value);
    target = parseDatabaseTarget(value);
  } catch {
    throw new StagingPreflightError(
      `Render ${key} must be a valid PostgreSQL URL`
    );
  }
  if (target.database !== "neondb" || (url.port && url.port !== "5432")) {
    throw new StagingPreflightError(
      `Render ${key} must use neondb on port 5432`
    );
  }
  for (const param of url.searchParams.keys()) {
    if (connectionOverrides.has(param.toLowerCase())) {
      throw new StagingPreflightError(
        `Render ${key} contains a connection override`
      );
    }
  }
  return target.host;
}

async function readNeonEndpoints(
  fetch: typeof globalThis.fetch,
  token: string
) {
  const { branch } = await getJson(
    fetch,
    `${NEON_PROJECT}/branches/${NEON_BRANCH_ID}`,
    "Neon staging branch",
    neonBranchSchema,
    token
  );
  if (
    branch.id !== NEON_BRANCH_ID ||
    branch.project_id !== NEON_PROJECT_ID ||
    branch.name !== "staging" ||
    branch.default
  ) {
    throw new StagingPreflightError(
      "Neon must report the expected non-default staging branch in the expected project"
    );
  }

  const url = new URL(`${NEON_PROJECT}/endpoints`);
  const check = "Neon project endpoints";
  const cursors = new Set<string>();
  const endpoints: z.infer<typeof neonEndpointSchema>[] = [];
  for (;;) {
    const page = await getJson(fetch, url, check, neonEndpointsSchema, token);
    endpoints.push(...page.endpoints);
    const cursor = page.pagination?.cursor;
    if (!cursor) return endpoints;
    if (cursors.has(cursor)) {
      throw new StagingPreflightError(`${check}: repeated pagination cursor`);
    }
    cursors.add(cursor);
    url.searchParams.set("cursor", cursor);
  }
}

export async function verifyStagingRelease({
  sha,
  renderApiKey,
  neonApiKey,
  fetch,
}: {
  sha: string;
  renderApiKey: string;
  neonApiKey: string;
  fetch: typeof globalThis.fetch;
}): Promise<{ sha: string; ciRunUrl: string }> {
  const ciRunUrl = await verifyMasterCI(fetch, sha);
  const hosts = await readRenderDatabaseHosts(fetch, renderApiKey);
  const endpoints = await readNeonEndpoints(fetch, neonApiKey);
  const endpoint = endpoints.find(
    (candidate) =>
      candidate.host === hosts.direct &&
      candidate.project_id === NEON_PROJECT_ID &&
      candidate.branch_id === NEON_BRANCH_ID &&
      candidate.type === "read_write" &&
      !candidate.disabled
  );
  if (!endpoint) {
    throw new StagingPreflightError(
      "Render DIRECT_URL must use the direct host of an enabled Neon staging read-write endpoint"
    );
  }
  if (hosts.pooled !== endpoint.host.replace(".", "-pooler.")) {
    throw new StagingPreflightError(
      "Render DATABASE_URL must use the pooled host of the same Neon staging endpoint as DIRECT_URL"
    );
  }

  const { object } = await getJson(
    fetch,
    MASTER_REF,
    "GitHub master ref recheck",
    masterRefSchema
  );
  if (object.sha !== sha) {
    throw new StagingPreflightError(
      "GitHub master moved during preflight. Rerun with the new master SHA after CI passes"
    );
  }
  return { sha, ciRunUrl };
}
