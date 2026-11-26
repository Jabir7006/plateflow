# PlateFlow — instructions for AI assistants

Read `MULTI-TENANT-HANDOFF.md` §0 ("Resume here") before doing anything. That
section is the authoritative, always-current state of the project: status, what
changed, the next action, the rules, and the commands. Do not rely on memory or
on this file for status.

## Plan before implementation

- For every new feature or task, write a self-contained implementation plan in
  `docs/plans/<task>.md` before editing code or changing any external system.
  Link the plan under **Next action** in `MULTI-TENANT-HANDOFF.md` §0. If a plan
  already exists, check it against the current checkout and update it first.
- Record the starting state, goal, scope, architecture and decisions, exact
  files and entry points, interfaces or data changes, ordered steps, edge
  cases, tests with commands and expected results, and acceptance criteria.
  Include prerequisites, required authorizations, and rollout or recovery
  steps where they apply. Keep secrets out of the plan.
- Write for a fresh session using a cheaper model. It should be able to
  implement and verify the task from the plan and linked repository files
  without reading the planning conversation or guessing material decisions.
  Record unresolved decisions and what must be resolved before dependent work.
- When the user asks for planning only or wants to hand off implementation,
  stop after saving the plan and updating §0. When asked to implement, follow
  the saved plan and record any material scope or design changes in it.

## Keep the handoff alive

- Before finishing — and as soon as context is running low — update §0:
  **Status, Next action, Changed**, plus any blocker, so a future session can
  continue from the single word "continue".
- List the files you changed or left uncommitted; the next session starts there.

## Hard rules

- Commit or push only when the user explicitly asks.
- Never put secrets, DB URLs or passwords in chat or in commits. Staging
  credentials live outside the repo at `~/.config/plateflow/staging.env` (600).
- Fresh checkout: run `pnpm --filter backend db:generate` first
  (`backend/src/generated/prisma` is gitignored).
- Use `prisma migrate deploy`; never `prisma migrate dev` (it can offer a
  destructive reset). Never run `db:seed` against staging or production.
- Write real tests (unit + integration) for every feature; run lint, typecheck
  and tests, and show the output.
- Preserve multi-tenant isolation. Payment/billing work is out of scope.
- Local scratch: `backend/.verify/`, `.openidea/` (gitignored).

## Working style

- Answer in simple Bengali/Banglish unless the user asks otherwise.
- Be concise; show commands and their output as evidence.
