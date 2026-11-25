# Continuous integration

`.github/workflows/ci.yml` provides the **CI** check for pull requests to
`master`, pushes to `master`, merge-queue checks and manual runs. The single job
stops on a failed command and has a 15-minute timeout; a new run cancels the
previous run for the same branch/PR.

It runs the repository's Node version from `.node-version` and pnpm version from
the root `packageManager`, with a frozen lockfile. Third-party Actions and the
Postgres image are pinned to verified commits/digest. The pnpm dependency store
is cached; generated clients and application build output are not reused.

## Checks

The job verifies native Temporal, installs dependencies, generates Prisma, runs
backend/frontend lint and typechecks, unit tests, migrations and integration
tests, then builds shared/backend/frontend in production mode.

Postgres 18.7 is a disposable service bound to the runner's loopback interface.
Its run-specific credential is only for synthetic test data. The helper
`backend/scripts/ci-env.ts` derives **DATABASE_URL, DIRECT_URL and TEST_DATABASE_URL together**
from that service, supplies fresh test-only application credentials and matching
frontend/backend image settings, and masks credentials/DSNs before later logs.
No repository deployment secrets or external database credentials are needed.

The helper refuses execution outside GitHub Actions, rejects malformed inputs,
and exports through the runner's existing `GITHUB_ENV` file. Dotenv loading is
disabled for backend commands. UTC makes clock-sensitive tests consistent, and
Sharp uses its bundled binaries instead of the runner's global libvips.

`prisma migrate deploy` initializes this disposable database. The tenancy
migration already creates its baseline restaurant; CI does not need `db:seed`.
The one legacy-seed regression test intentionally skips because no seeded owner
and tables exist. The job's service is removed when it finishes.

## CI, release gates and CD

CI reports whether a revision passes the checks. A **release gate** is a
condition that must be satisfied before publishing: a passing check for the
revision, the correct database branch, reviewed migrations, backup when needed,
and staging acceptance. **CD** automates delivery/deployment around these gates.

This workflow implements CI. It does not perform deployments or add credentials
for them. Render remains on the approved manual deployment policy; follow
`DEPLOY-RUNBOOK.md` for database verification and backend-before-frontend rollout.
Vercel's existing Git integration still operates independently of this workflow.

A workflow check alone does not prevent merging. After the first hosted run
passes, an explicitly approved repository ruleset/branch-protection change can
require the **CI** check on `master`. Changing deployment settings or enabling
automatic backend deployment is a separate decision.

## Verification

The workflow passes actionlint 1.7.12. A clean temporary checkout outside the
workspace, without local `.env` files or a generated Prisma client, passed the
same command sequence on Node 26.13.1/pnpm 12.4.1 and an isolated local Postgres
18.7: 222 unit tests (27 files), 130 integration tests (11 files, 1 skipped),
lint/typechecks and all production builds (11 frontend routes). All nine
migrations applied from an empty database, and the temporary server was stopped.

The Node/Actions references and Docker image manifest were checked with their
official upstream repositories/registry. Hosted Actions execution remains to be
verified after an explicitly requested commit/push and pull request.
