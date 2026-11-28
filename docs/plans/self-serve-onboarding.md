# Self-serve restaurant onboarding

**Status** · Implemented, locally verified, and browser-accepted on 2026-11-28;
pushed for review on `feat/self-serve-onboarding` (PR #7); master merge and
release rollout pending. Final full suites, lint/typecheck, both flag builds,
and a real fixture signup pass.

**Baseline** · `master` at `269630a` after staging preflight PR #6. This change
branches from that commit. Preserve the handoff record. The
[admin provisioning CLI](../../backend/prisma/create-restaurant.ts) creates a
restaurant and its first active OWNER in one transaction. Staff invitations
join an existing restaurant. Login identifies a single account globally by
normalized email, and the [schema](../../backend/prisma/schema.prisma)
requires a unique restaurant slug and a tenant ID on each user.

## Outcome and scope

A restaurant owner can request a signup link from `/signup`, verify their
email, enter the restaurant name and reporting timezone, choose their own name
and password, and land on the existing dashboard signed in as the first OWNER.
The restaurant starts empty. Existing users sign in to their current
restaurant, and staff still join via invitation. Keep the admin CLI for
operator provisioning. Trial entitlements, plan gating, payments, memberships
across restaurants, password reset, and super-admin are later work.

This plan chooses an email-first flow using the existing Resend integration.
Restaurant and account rows are created only after a link holder submits the
completed form. The initial request collects one email address. The confirmed
email becomes the owner login and remains globally unique.

## API contract and form fields

Use the current JSON response envelope and the Next same-origin `/api/v1`
rewrite. The three routes accept POST JSON, are guest-accessible, and send
`Cache-Control: no-store` for their responses.

| Route under `/api/v1/auth` | Request body | Success |
| --- | --- | --- |
| `/signup/request` | `{ email }` | `202`, `data: null`, a generic inbox message for valid email inputs, including existing accounts, suppressed resends, and accepted delivery attempts |
| `/signup/verify` | `{ token }` | `200`, `data: { email }`; read-only lookup |
| `/signup/complete` | `{ token, restaurantName, timeZone, ownerName, password }` | `201`, existing `AuthUser` payload and existing session cookies |

Reuse the email normalizer in
[auth.schema.ts](../../packages/shared/src/schemas/auth.schema.ts) and cap signup
email at 254 characters. Trim names and timezone. Bound restaurant names to
2–120 characters, owner names to 2–100, and timezone names to 100. The backend
validates the timezone through
[`isValidTimeZone`](../../backend/src/lib/reporting-period.ts), including
rejection of fixed offsets. Require a password of at least 12 characters and
at most 72 UTF-8 bytes using a shared `TextEncoder` check. Preserve password
whitespace. Require a 43-character base64url token from `randomId(32)`. Keep
shared validation in named signup schemas and make the bodies strict. Extra
fields such as `email` on completion, `role`, `status`, `slug`, or
`restaurantId` fail validation. The server supplies the new tenant ID and
role.

Return the existing validation envelope with field errors for malformed
input, and one generic `400` for unknown, expired, rotated, or spent tokens.
A unique constraint conflict during completion returns a generic `409` with
sign-in and retry guidance. Use `429` for IP rate limits, `404` when signup
is disabled, and `403` for a supplied browser origin other than the origin of
`APP_URL`. Accept omitted Origin for direct clients. Restrict these routes
to JSON and keep the existing CORS behavior.

## Data and concurrency

1. Add the `OwnerSignupChallenge` model to `backend/prisma/schema.prisma` and
   one additive SQL migration under `backend/prisma/migrations/<timestamp>_owner_signup_challenge/migration.sql`.
   Use `id String @id @default(cuid())`, unique normalized `email`, unique
   `tokenHash`, `expiresAt DateTime`, and `resendAfter DateTime`. Index
   `expiresAt`. This table holds pre-tenant challenges, without a user or
   restaurant foreign key. Existing rows require zero backfill. Tokens expire
   after 30 minutes. Persist only the SHA-256 digest.
2. In `requestOwnerSignup`, generate a token and digest, then acquire the
   email's slot in a transaction. Update by `email` and
   `resendAfter <= now` to rotate an eligible row. When that update affects
   zero rows, try a one-row `createMany` with `skipDuplicates: true`. Send
   only for the winning write. Set `resendAfter` 60 seconds ahead and expiry
   30 minutes ahead on both create and rotation. This serializes concurrent
   requests across IPs. After writing the slot, check globally for a user
   with the email, selecting only `id`. For any existing account, delete
   the slot by email and the just-written digest within that transaction and
   return the generic response without sending a link.
3. Send after the transaction commits. Use
   `${APP_URL}/signup/complete#token=<raw-token>` with the configured frontend
   origin. Schedule the send on the long-lived Node process without awaiting
   the provider in the HTTP handler, so its latency or failure is absent
   from the `202`. Catch all send rejections and log a fixed operational
   message. Keep the same cooldown if delivery fails or the process exits
   before sending. The owner can request a fresh link after 60 seconds.
   The newest issued link is the valid one. Do a bounded best-effort cleanup
   of up to 100 expired rows after successful challenge issuance, using the
   expiry predicate and index. Expired rows left during idle periods are
   unusable and cleaned up on subsequent issuance.
4. For preview, find the challenge by digest and require `expiresAt > now`.
   Return only its email, with no writes, cookies, or account lookup. For
   completion, validate the token and timezone first, then hash the password
   with the existing bcrypt helper before opening the write transaction. In
   the transaction, claim the challenge with `deleteMany` matching its ID,
   digest, and expiry greater than the current time. Proceed only for count
   one. This covers concurrent completion, rotation during bcrypt, and
   expiry before the claim. Create the restaurant and active OWNER with the
   challenge's normalized email, then persist the first refresh session in
   the same transaction. Generate the internal slug as `signup-` plus 24
   lowercase hex characters from 12 random bytes. Keep the unique slug and
   email constraints as final authority. Map `P2002` outside the transaction,
   so any conflict rolls back the tenant, user, session, and token claim.
   A repeat attempt after a transient failure can reuse the valid challenge.
5. Write cookies only after the transaction returns. If the response is
   lost after commit, the owner can sign in with the chosen password.
   Existing users, including invited and disabled accounts, keep their
   account, role, and restaurant throughout.

## Implementation order and files

1. **Schema and contracts.** Add the model and migration specified above.
   Add signup schemas and inferred types to
   `packages/shared/src/schemas/auth.schema.ts`, already exported by
   `packages/shared/src/index.ts`. Add the preview response type to
   `packages/shared/src/types/auth.types.ts` and `ACCEPTED: 202` to
   `backend/src/constants/http.ts`. Set
   `SELF_SERVE_SIGNUP_ENABLED=false` by default in
   `backend/src/config/env.ts` and document it in `backend/.env.example`.
2. **Provisioning and auth.** Extract the two create calls into
   `backend/src/lib/provision-restaurant.ts` as
   `createRestaurantWithOwner(tx, input)`. Keep the CLI's validation, inputs,
   password handling, transaction, and output in `backend/prisma/create-restaurant.ts`.
   Use the helper in `completeOwnerSignup` in
   `backend/src/modules/auth/auth.service.ts`. Reuse its `issueTokens`
   transaction-client parameter and `toAuthUser`. Host the challenge request
   and read-only lookup in `backend/src/modules/auth/owner-signup.service.ts`
   and the email body builder in
   `backend/src/modules/auth/owner-signup.template.ts`. Reuse
   `backend/src/lib/mail.ts` and add signup-specific error handling there
   that suppresses raw provider errors and addresses. In
   `backend/src/middlewares/error.middleware.ts`, log only the method, route,
   and a safe error classification for signup requests, including JSON parse
   errors. Keep secrets, raw links, passwords, bodies, and digests out of logs
   and error responses.
   In `backend/tests/unit/lib/tenant-scope.ts`, classify the challenge as a
   pre-tenant model and pin the intentional registration lookup by unique
   email to `requestOwnerSignup`. The shared user create must set the ID of
   the restaurant created in the same transaction.
3. **Routes and abuse controls.** Add the three routes and route-specific
   feature gate, origin, JSON, and cache checks in
   `backend/src/modules/auth/auth.routes.ts`. Put handlers in
   `backend/src/modules/auth/auth.controller.ts` and reuse `validate`,
   `setAuthCookies`, and the existing session context. Add signup IP limiters
   in `backend/src/middlewares/rate-limit.middleware.ts` using
   `createRateLimiter` and the existing `RATE_LIMIT_ENABLED` setting.
   Use 5 requests per 15 minutes for link requests and a separate shared bucket
   of 20 per 15 minutes for verify and complete. Count successful requests
   as well as failures. Keep the existing single-instance limit model and
   separate auth limiter.
4. **Guest UI.** Add `frontend/app/(auth)/signup/page.tsx` and
   `frontend/app/(auth)/signup/complete/page.tsx`. Build the two forms as
   `frontend/features/auth/components/signup-request-form.tsx` and
   `signup-complete-form.tsx` in that directory. Use the current guest
   layout, form controls, Zod resolver, `api-field-errors.ts`, and pending
   states. Add the requests in `frontend/features/auth/api.ts`. Read the
   fragment in a mount effect, retain the token only in component memory,
   and immediately clear the fragment with `history.replaceState`. Preserve
   the token on React Strict Mode's effect rerun. Use component-local async
   requests and pending state for preview and completion. Keep token and
   password out of query and mutation caches. Show the verified email
   read-only, preselect the browser's named timezone when available, and offer
   editable IANA choices including UTC. Explain how to reopen or request a link if the fragment is
   missing, invalid, or expired. Establish the session through `useSetSession`
   to clear cached data from a prior tenant, then use the fixed `/dashboard`
   destination. Extend `frontend/features/auth/redirects.ts` to keep signup
   guest paths out of return targets. Add a signup link to the login page.
   Gate both pages and the link with the build-time
   `NEXT_PUBLIC_SELF_SERVE_SIGNUP_ENABLED=true` flag and document the default
   in `frontend/.env.example`. A landing-page redesign is out of scope.
5. **Operations.** Add onboarding flag and release notes to
   `docs/STAGING-DEPLOY-GUIDE.md` and `docs/DEPLOY-RUNBOOK.md`. Include the
   Resend prerequisites, recipient cooldown, stale link recovery, and rollout
   sequence below.

## Tests and acceptance

- `backend/tests/unit/schemas/owner-signup.schema.test.ts` covers email
  normalization, field limits, token shape, password whitespace and the
  72-byte Unicode boundary, and strict rejection of client-supplied tenant
  identity. Verify named timezone acceptance and fixed-offset rejection
  through the existing validator. Keep tenant-scope tests and CLI timezone
  tests green.
- `backend/tests/integration/owner-signup.test.ts` uses the real Express
  routes and disposable Postgres through `backend/tests/harness.ts`, with
  mocked mail using the pattern in `staff-invite.test.ts`. Read the synthetic
  link from the mail mock. Track exact fixture emails and tenant IDs for FK-safe
  cleanup. Cover the disabled API, generic request response for active,
  invited, and disabled users, no tenant or session before completion, digest
  storage, mail failure and recovery, resend cooldown and rotation, expiry,
  concurrent requests and double completion, DB uniqueness rollback after
  an email is claimed elsewhere, and limiter behavior. Assert that completion
  yields exactly one restaurant, OWNER, and refresh session. Exercise cookie
  auth through `/auth/me`, refresh, logout, and normal login. Verify two
  tenants can use the same table number while each dashboard/list shows only
  its own data. Confirm ordinary CLI provisioning and staff invitations.
- Browser acceptance on the local frontend covers the disabled link and
  direct routes, the email request acknowledgement, link fragment removal
  and expired state, desktop and mobile forms, timezone selection, field and
  retry errors, double-submit prevention, and session restoration after
  dashboard reload. Sign out of an existing tenant before signup in the same
  tab and verify its cached data stays out of the new dashboard. Check that
  direct entry using a forwarded link still displays the verified email
  before completion. Use an isolated local challenge fixture for the browser
  completion check. Insert a challenge for a synthetic address with a
  known digest and short expiry into the disposable database and open the
  corresponding local fragment URL. The integration suite covers delivery.

Use the Node and pnpm versions pinned in the repository. Match
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) with a disposable
Postgres 18 database and test-only settings. From the repo root run:

```bash
pnpm install --frozen-lockfile
pnpm --filter backend db:generate
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm --filter backend db:migrate:deploy
pnpm test:integration
pnpm build
NEXT_PUBLIC_SELF_SERVE_SIGNUP_ENABLED=true pnpm --filter frontend build
git diff --check
```

Expect all commands to exit 0, the additive migration to apply on an empty
database and on one at the PR #6 baseline, and the signup tests to pass with
the existing documented suite skip. Build with the flags off and with the
public flag on. Record exact counts and browser evidence in handoff §0.

## Rollout and recovery

Commit, push, and external rollout require the user's authorization. On an
approved staging rollout, verify the exact release SHA with the
[staging preflight](../DEPLOY-RUNBOOK.md#5-pre-deploy-checklist), apply the
additive migration with `prisma migrate deploy`, and deploy with both flags
off. Verify the staging `APP_URL`, trusted proxy configuration, enabled rate
limits, and a Resend sender verified for the intended recipient scope. Enable
the backend flag first and run one scoped smoke test using a controlled inbox.
Verify that the delivered link preserves its fragment and that cookies restore
the signed-in session. Then enable the frontend flag and rebuild. A working
sender for the intended public audience and approval to enable the flow are
rollout prerequisites. Local implementation can use synthetic mail fixtures.

For rollback, disable the backend flag first to stop new requests and
completion, then rebuild the frontend with the link hidden. Keep existing
tenants and accounts usable through login and the CLI. The additive challenge
table can stay in place. Re-enable only after verifying the underlying issue
and ask users with expired challenges to request fresh links.

## Review remediation (2026-11-26)

An independent review found six issues in the first implementation. All six are
accepted and fixed here:

1. **Signup error redaction.** The signup matcher was case-sensitive while
   Express routing is not, and the unexpected-error branch logged the full error
   object again and exposed `err.message` in development. The matcher is now
   case-insensitive, signup failures log only method/route/classification, and
   signup always receives the generic 500 message.
2. **Cleanup versus resend.** Expired-row cleanup selected ids, then deleted by
   id. The delete now repeats the expiry cutoff in its predicate, so a row that
   gained a fresh expiry between select and delete is left alone. Multi-link
   issuance below also means a resend never rewrites an old row.
3. **Lost fragment on retry.** The completion form now retries verification
   from the token already in memory instead of reloading the page. A pure
   `canRetrySignupVerification` helper records the 400-versus-transient rule.
4. **bcrypt before lookup.** Completion now pre-checks a live challenge before
   hashing the password, then claims the token atomically inside the
   transaction. Unknown or expired tokens no longer spend bcrypt work.
5. **Resend cancels an open link.** Challenges are now append-only until they
   expire: dropping the unique email constraint lets a resend add a second live
   link, while a per-email advisory lock preserves the 60-second cooldown under
   concurrent requests. Completion retires every challenge for the email in the
   same transaction. One address can therefore have more than one valid link,
   which is the deliberate change from the original single-slot design.
6. **Body parsing before signup guards.** Signup moved to its own router mounted
   before the global JSON parsers. Cache, feature-flag, origin, and content-type
   checks now run first, so malformed or oversized bodies still carry
   `Cache-Control: no-store`, and a disabled flag returns 404 before parsing.

New migration: `20261126200000_owner_signup_multiple_links` drops the unique
email index, adds `createdAt`, and adds a non-unique email index. It is
additive apart from the unique-index replacement: existing rows are valid,
one-live-link accounts keep working, and no data is rewritten destructively.

## Re-review remediation (2026-11-26, second pass)

A second review found five follow-up issues. All are accepted; this pass fixes
them without changing the API contract:

1. **Same-tab new link ignored.** A fragment change does not remount the page.
   The completion form now listens for `hashchange`, captures and verifies the
   replacement token, clears the old preview/error/retry state, and removes the
   new fragment from the address bar. The initial mount still uses the ref guard
   so Strict Mode cannot lose the first token.
2. **Prisma logs bypass handler redaction.** Prisma's own stdout logger printed
   the full error before Express saw it. Error-level Prisma logs now use event
   emission and a callback that records only `target` and the fixed
   `prisma_error` classification, never the message. Development query/warn
   logging stays stdout; production emits errors only through the redacting
   callback.
3. **Blocking advisory lock can pin the shared pool.** Signup issuance now uses
   `pg_try_advisory_xact_lock`. If another request holds the per-email lock, the
   loser returns the same generic `202` without waiting. Completion keeps the
   blocking lock because it must claim a token.
4. **URL-only signup detection misses the mount root.** The signup router marks
   `res.locals.signupRoute = true` before any guard can fail. The error handler
   checks that marker first and keeps the URL matcher only as a backstop for
   errors thrown before the router.
5. **Raw-SQL allowlist too broad.** Tenant-scope exceptions were narrowed to
   the two documented advisory-lock queries. The third pass replaces the initial
   substring check with an exact whitespace-normalized template match.

Verification for this pass is recorded after implementation below.

## Third review remediation (2026-11-26)

A third review found three follow-up issues. All are accepted:

1. **New link inherited old form values.** Replacing the token cleared the
   preview and error state but not React Hook Form's values, so the new email
   could be submitted with the previous restaurant/name/password. Token capture
   now calls `reset()` before verifying the replacement link.
2. **Late completion response overwrote a replacement link.** If link B arrived
   while link A's completion was in flight, A's late 400 could mark B broken.
   Link replacement is now deferred while a submit is pending: the new fragment
   is captured and stripped, but applied only after A fails. If A succeeds, the
   queued replacement is discarded and the dashboard navigation wins.
3. **Raw-SQL allowlist still substring-based.** An advisory-lock substring plus
   an extra tenant read could pass. Entries now store the full whitespace-
   normalized lock template and must match it exactly; modifying the statement
   fails the guard.

Verification for this pass is recorded below.

## Implementation record (2026-11-26)

Changed and committed with this plan:

- Shared: `packages/shared/src/schemas/auth.schema.ts`,
  `types/auth.types.ts`, `index.ts`.
- Backend: new `OwnerSignupChallenge` model and additive migrations,
  `lib/provision-restaurant.ts`, `modules/auth/owner-signup.service.ts`,
  `owner-signup.template.ts`, and `modules/auth/owner-signup.routes.ts` (the
  pre-parser router); edits to env/config, HTTP and auth constants, mail, error
  and rate-limit middleware, auth controller/routes/service, the admin CLI, and
  `tests/unit/lib/tenant-scope.ts`.
- Backend tests: new `tests/unit/schemas/owner-signup.schema.test.ts`,
  `tests/unit/lib/owner-signup-template.test.ts`, and four signup integration
  suites (`owner-signup.test.ts`, `-guards`, `-disabled`, `-rate-limit`);
  `tests/unit/middlewares/error.test.ts` gained redaction and non-signup
  diagnostics cases.
- Frontend: `app/(auth)/signup/page.tsx`, `signup/complete/page.tsx`,
  `features/auth/signup-flag.ts`, both signup form components, signup calls in
  `features/auth/api.ts`, guest-path guard in `features/auth/redirects.ts`,
  gated link on the login page, and `frontend/.env.example`.
- Frontend tests: added Vitest to `frontend/package.json` with a `test` script,
  `features/auth/signup-token.ts` (fragment parser extracted from the form),
  `features/auth/signup-retry.ts` (400-versus-transient retry rule),
  `features/auth/signup-token.test.ts`, `features/auth/signup-retry.test.ts`,
  and `features/auth/redirects.test.ts`. CI now runs
  `pnpm --filter frontend test` after the backend unit suite.
- Docs: this plan, `docs/STAGING-DEPLOY-GUIDE.md`, `docs/DEPLOY-RUNBOOK.md`,
  and `MULTI-TENANT-HANDOFF.md`.

Material changes from the original plan:

- The signup rate limits are env-configurable
  (`RATE_LIMIT_SIGNUP_REQUEST_MAX`, `RATE_LIMIT_SIGNUP_LINK_MAX`). Defaults
  remain 5 and 20 per 15 minutes; the env knobs let the rate-limit integration
  test use small budgets without a module reload.
- The completion form adds a client-only confirm-password field. It is never
  sent: the strict API body still accepts only `token`, `restaurantName`,
  `timeZone`, `ownerName`, and `password`.
- Integration coverage is split into four focused suites instead of one file.
  The harness is unchanged; each suite connects the shared `db` client in
  `beforeAll` and compares Prisma timestamps through raw SQL with
  `AT TIME ZONE 'UTC'` because Prisma writes naive UTC.
- With the frontend flag off, direct visits render the app's 404 UI but return
  HTTP 200: the `(auth)` layout streams inside Suspense, and Next uses 200 for
  streamed not-found responses. The form and login link are absent, and the
  backend routes still return a true 404. This is accepted for the guest UI;
  the API is the security boundary.

Verification (2026-11-28, Node 26.13.1, pnpm 12.4.1, disposable Postgres 18.7):

- Root `pnpm lint`, `pnpm typecheck`, and `git diff --check` pass.
- Backend unit suite: 30 files, 299 tests pass, including the case-insensitive
  signup-redaction case, the marked-mount-root redaction case, and the
  tenant-scope tests that require an exact whitespace-normalized advisory-lock
  template. A modified lock statement with an extra tenant read is a violation,
  not an allowed exception.
- Frontend Vitest suite: 3 files, 27 tests pass (redirect safety, signup fragment
  parsing, and the 400-versus-transient retry rule). It has no DOM/component
  harness; the live acceptance below covers the form behavior.
- Full integration suite: 16 files, 161 passed, 1 documented legacy-seed skip,
  after all 11 migrations. This includes the four focused signup suites (22
  tests) covering digest-only storage, generic responses for existing accounts,
  the cooldown, multiple live links after a resend, concurrent-request
  serialization, mail failure, preview, full completion, sibling-link
  retirement, timezone/password/extra-field rollback, P2002 rollback, concurrent
  completion, origin/JSON/cache guards, disabled routes (404 before parsing even
  for malformed or oversized bodies), and limiter buckets.
- Production builds: backend `tsc` pass; frontend flag-off and flag-on builds
  each pass and list `/signup` and `/signup/complete`. Prisma's engine cache
  was pointed at `backend/.verify/prisma-cache` because the sandbox home is
  read-only.
- Real browser acceptance with the flag on, using a disposable database, the
  production backend and the Next dev server on `localhost`:
  - `/signup` rendered the request form and `/login` showed the signup link.
  - Fixture link A opened on `/signup/complete`; the fragment was stripped, the
    verified email appeared read-only, and the form accepted values.
  - While A's completion request was deliberately held, the tab navigated to
    fixture link B. A's email, pending button, and field values stayed in place,
    proving the replacement was deferred rather than applied mid-submit.
  - Resolving A as a failure then applied B: the email switched to B, the submit
    button returned to idle, every text/password field except the prefilled time
    zone was cleared, and no stale error remained.
  - Submitting B for real created the restaurant and OWNER and landed on
    `/dashboard` with B's restaurant name and owner. The database contained
    exactly that active OWNER and restaurant; A had no account.
  - An earlier acceptance run verified fragment removal, completing a fixture
    link, reloading the dashboard with the restored session, the spent-token
    generic `400`, and the broken-link UI for a missing fragment.
- Flag-off build: the login link is absent and direct `/signup` visits render the
  404 UI (HTTP 200 caveat above).

Not exercised in the browser: requesting a real email (no message was sent
through Resend), mobile viewport, double-submit timing, and the in-place retry
after a transient verify failure. Retry has a helper unit test; the API suites
cover the underlying rules.
