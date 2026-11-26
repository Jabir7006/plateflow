# Staging release preflight

**Status** · Ready for implementation when requested.  
**Baseline** · `master` at `fe4ed73` plus the branch-protection and planning docs.

Read [the project rules](../../AGENTS.md), [handoff §0](../../MULTI-TENANT-HANDOFF.md#0-resume-here),
[CI](../CI.md), [runbook §5–6](../DEPLOY-RUNBOOK.md#5-pre-deploy-checklist), and
[staging guide §4](../STAGING-DEPLOY-GUIDE.md#4-migrations-before-the-first-deploy).
Check the current `master` before editing and update this plan if its assumptions
have changed. The next session can be prompted with `Implement docs/plans/staging-release-preflight.md`.

## Outcome and scope

An operator runs one command before the existing manual staging release. It
confirms that a specific commit is still the tip of `master`, that its GitHub
Actions `CI` push run passed, and that the two database URLs configured on the
actual staging Render service point to the expected staging database. A failed
check exits nonzero with a safe, actionable reason. A past staging misconfiguration
had a valid pooled staging URL and a direct URL pointing at production. Both
URLs must pass independently before the command reports success.

This phase adds a local, read-only command. Migrations, backup, rollout,
post-deploy smoke tests, and rollback still follow the runbook. Automated CD,
GitHub Actions secrets, workflow triggers, provider settings, schema changes,
and production releases are outside this phase. Live execution of the new command
is optional during implementation and requires access to the approved staging
service and Neon project. All automated tests use synthetic inputs.

## Command and dependencies

```bash
pnpm --filter backend release:preflight:staging --sha <full-master-sha>
```

Use `--sha` followed by one full 40-character hexadecimal commit SHA. Reject
missing, duplicate, extra, or invalid arguments before loading credentials or
making requests. Normalize uppercase hex to lowercase. The operator supplies
`PLATEFLOW_RENDER_API_KEY` and `PLATEFLOW_NEON_API_KEY` through their existing
private secret mechanism as environment variables. The command reads no dotenv
file and accepts no URL, service ID, project/branch ID, or API origin override.
GitHub is public and the command uses unauthenticated GET requests. A rate-limit
response is a failed preflight and can be retried after the limit resets.

Pin these non-secret identities in the staging command. Recheck them against
the handoff and private operational scripts before implementation.

| Provider | Expected target |
| --- | --- |
| GitHub | `Jabir7006/plateflow`, branch `master`, workflow `ci.yml`, job `CI` |
| Render | `srv-dc0hkk3m8hqs73ei58v0`, `plateflow-staging-api`, branch `master`, auto-deploy `no` |
| Neon | Project `billowing-flower-85802013`, branch `br-delicate-math-azov6qa2` named `staging`, database `neondb` |

Use Node's built-in `fetch` with a 15-second timeout per request, `redirect: "error"`,
and hardcoded provider origins. Use the installed `zod` for response parsing
or explicit checks on every consumed field. Pass the fetch function and tokens
into the core function so tests exercise the real request order and response
handling without provider credentials. Use `backend/scripts/lib/database-target.ts`
for its shared PostgreSQL URL parsing. Port the relevant endpoint checks from
`backend/.verify/neon-utils.mjs` after verifying their current behavior. The
tracked command and tests must run in a fresh checkout with no `.verify/` files.

## Implementation order

1. Add `backend/scripts/lib/staging-release-preflight.ts` with
   `verifyStagingRelease({sha, renderApiKey, neonApiKey, fetch})`. Return only
   `{sha, ciRunUrl}` on success. Treat missing or malformed provider fields,
   non-2xx responses, redirects, and timeouts as failures. Label errors with the
   provider and failed check, using fixed text and numeric HTTP status only.
   Never print request headers, API response/error bodies, parsed URLs, or raw
   exceptions. Do not follow provider-supplied URLs.
2. Check the exact release revision first. GET GitHub
   `/repos/Jabir7006/plateflow/git/ref/heads/master` and require `object.sha`
   to match the argument. GET that repo's `/actions/workflows/ci.yml/runs`
   with `branch=master`, `event=push`, `head_sha=<sha>`, and `per_page=1`.
   Require the returned run to match the SHA, branch, and event with
   `status=completed` and `conclusion=success`. Verify that the latest attempt
   has a completed, successful `CI` job via `/actions/runs/{id}/attempts/{attempt}/jobs`.
   Validate both numeric IDs before building paths. Build `ciRunUrl` from the
   fixed repository and numeric run ID. Missing, pending, skipped, or failed CI
   stops the command before Render or Neon is queried.
3. GET `https://api.render.com/v1/services/{serviceId}` and verify returned
   ID, name, branch, and `autoDeploy`. GET the staging service's `/env-vars`
   collection with `limit=100`. Follow Render's cursor pagination when the
   page is full. Reject repeated cursors and duplicate matching keys. Read only
   `DATABASE_URL` and `DIRECT_URL` from the `envVar` entries and require both.
   Pass the Render bearer token only to Render. Keep both values in memory.
4. GET `https://console.neon.tech/api/v2/projects/{projectId}/branches/{branchId}`
   and that project's `/endpoints`, following endpoint pagination if returned.
   Verify the expected project and branch IDs and branch name. Require a
   non-default staging branch and an enabled read-write endpoint whose
   `project_id` and `branch_id` match. Pass the Neon bearer token only to Neon.
   Parse both PostgreSQL URLs. Require `neondb` and port 5432 (implicit is fine).
   Require `DATABASE_URL` to match the endpoint hostname with `-pooler` appended
   to its first DNS label and `DIRECT_URL` to match the endpoint hostname exactly.
   Require the same endpoint for both. Reject query keys `host`, `hostaddr`,
   `port`, `database`, `dbname`, `options`, `user`, and `password`
   case-insensitively. This step checks metadata only and opens no SQL connection.
5. Re-read the `master` ref before reporting success. If it moved, instruct the
   operator to rerun with the new revision after CI. A pass covers the exact
   SHA at preflight time. The operator still pins the manual release to that SHA.
6. Add the CLI at `backend/scripts/staging-release-preflight.ts` and
   `release:preflight:staging` in `backend/package.json` using `tsx`. The CLI
   checks arguments and required env names, calls the core function, and prints
   only `Staging release preflight passed for <sha>` plus the CI run URL on
   success. On failure, print one sanitized message to stderr and exit 1.
   Add a preflight invocation to [runbook §5](../DEPLOY-RUNBOOK.md#5-pre-deploy-checklist)
   and explain where it fits in the existing manual sequence.

## Tests and acceptance

Add `backend/tests/unit/scripts/staging-release-preflight.test.ts`. Use mocked
fetch responses and assert methods, URLs, ordering, and which hosts receive
credentials. Cover a valid run, wrong or moving `master`, missing/pending/failed
CI and a skipped or missing `CI` job, Render service mismatch or enabled
auto-deploy, absent/duplicated DB variables, paginated fixtures, swapped URL
roles, different endpoints, the historical production `DIRECT_URL` case,
invalid URLs and connection overrides, disabled/default/wrong Neon targets,
HTTP failures, malformed JSON, and rejected requests. Assert that inputs with
sentinel passwords or tokens never appear in returned errors or results.

Add `backend/tests/integration/staging-release-preflight.test.ts` to spawn the
real CLI with Vitest and `tsx`, following `ci-environment.test.ts`. Test missing
or extra arguments and absent credentials with an isolated env. For success and
failure across the CLI boundary, preload a temporary Node module that replaces
`globalThis.fetch` with synthetic provider fixtures and rejects any unexpected
request. Assert exit codes, stdout/stderr, no real network and no secret output.
Remove temporary fixture files after the tests.

Run the same checks as CI from the repo root using a disposable database only.
On a fresh checkout, configure that isolated environment and generate Prisma
before lint, typecheck, or tests.

```bash
pnpm --filter backend db:generate
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm --filter backend db:migrate:deploy
pnpm test:integration
pnpm build
git diff --check
```

Acceptance requires the command to pass only with an exact, green master SHA and
two correctly scoped Render URLs, and to fail cleanly in all negative cases.
Record the commands and results in handoff §0. A read-only live run, if done,
records only its SHA, CI run URL, and pass/fail result. If a preflight fails,
stop the release until the check can be rerun successfully. Reverting the CLI
requires only reverting its code and docs. There is no database or provider
state to roll back.
