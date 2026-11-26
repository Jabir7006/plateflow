export const SHA = "a1".repeat(20);
export const OTHER_SHA = "b2".repeat(20);
export const RENDER_TOKEN = "synthetic-render-token";
export const NEON_TOKEN = "synthetic-neon-token";
export const DB_PASSWORD = "synthetic-db-password";
export const CI_RUN_URL =
  "https://github.com/Jabir7006/plateflow/actions/runs/1234";
export const STAGING_HOST = "ep-staging.synthetic.neon.tech";
export const POOLED_HOST = "ep-staging-pooler.synthetic.neon.tech";
export const PRODUCTION_HOST = "ep-production.synthetic.neon.tech";

const github = "https://api.github.com/repos/Jabir7006/plateflow";
const renderServiceId = "srv-dc0hkk3m8hqs73ei58v0";
const render = `https://api.render.com/v1/services/${renderServiceId}`;
const projectId = "billowing-flower-85802013";
const branchId = "br-delicate-math-azov6qa2";
const neon = `https://console.neon.tech/api/v2/projects/${projectId}`;

export type Reply = { url: string; body: unknown; token?: string };

export function databaseUrl(host: string) {
  return `postgresql://example:${DB_PASSWORD}@${host}/neondb?sslmode=require`;
}

export function envVar(key: string, value: string, cursor = "example-cursor") {
  return { cursor, envVar: { key, value } };
}

export function preflightReplies() {
  const masterUrl = `${github}/git/ref/heads/master`;
  const success = { status: "completed", conclusion: "success", head_sha: SHA };
  return {
    master: { url: masterUrl, body: { object: { sha: SHA } } },
    ci: {
      url: `${github}/actions/workflows/ci.yml/runs?branch=master&event=push&head_sha=${SHA}&per_page=1`,
      body: {
        workflow_runs: [
          {
            ...success,
            id: 1234,
            run_attempt: 2,
            event: "push",
            head_branch: "master",
          },
        ],
      },
    },
    jobs: {
      url: `${github}/actions/runs/1234/attempts/2/jobs?per_page=100`,
      body: { total_count: 1, jobs: [{ ...success, name: "CI" }] },
    },
    service: {
      url: render,
      token: RENDER_TOKEN,
      body: {
        id: renderServiceId,
        name: "plateflow-staging-api",
        branch: "master",
        autoDeploy: "no",
      },
    },
    vars: {
      url: `${render}/env-vars?limit=100`,
      token: RENDER_TOKEN,
      body: [
        envVar("DATABASE_URL", databaseUrl(POOLED_HOST)),
        envVar("DIRECT_URL", databaseUrl(STAGING_HOST)),
      ],
    },
    branch: {
      url: `${neon}/branches/${branchId}`,
      token: NEON_TOKEN,
      body: {
        branch: {
          id: branchId,
          project_id: projectId,
          name: "staging",
          default: false,
        },
      },
    },
    endpoints: {
      url: `${neon}/endpoints`,
      token: NEON_TOKEN,
      body: {
        endpoints: [
          {
            host: STAGING_HOST,
            project_id: projectId,
            branch_id: branchId,
            type: "read_write",
            disabled: false,
          },
          {
            host: PRODUCTION_HOST,
            project_id: projectId,
            branch_id: "br-production",
            type: "read_write",
            disabled: false,
          },
        ],
      },
    },
    masterRecheck: { url: masterUrl, body: { object: { sha: SHA } } },
  } satisfies Record<string, Reply>;
}
