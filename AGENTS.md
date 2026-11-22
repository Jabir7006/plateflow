# PlateFlow — instructions for AI assistants

Read `MULTI-TENANT-HANDOFF.md` §0 ("Resume here") before doing anything. That
section is the authoritative, always-current state of the project: status, what
changed, the next action, the rules, and the commands. Do not rely on memory or
on this file for status.

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
