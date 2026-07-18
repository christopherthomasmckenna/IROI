# Project: RJC Impact ROI Calculator

## What this is
A web app porting an Excel-based Restorative Justice Conferencing (RJC) Impact
ROI model into an interactive, role-based site with persistent, shareable cases.

Two docs are authoritative — read them before touching the relevant area, don't
duplicate their content into this file as it evolves:
- `docs/roi-calculator-app-brief.md` — roles, access rules, data model, stack.
  Read before changing permissions, schema, or page structure.
- `docs/roi-model-fields.json` — every input field, its cell reference back to
  the source spreadsheet, default value, and `creator_editable` flag, plus the
  calculation chain and reference output values. Read before touching the
  calculation engine.
- `docs/IROI_IMPACT_MODEL.xlsx` — the **source spreadsheet** itself, the ground
  truth for the math. `src/lib/calculator/__tests__/spreadsheet-parity.test.ts`
  reads its "Impact ROI" output cells and diffs them against the engine for the
  default inputs. Run `npm test` whenever you touch the math — if the code and
  the spreadsheet disagree, parity fails. (Uses `exceljs`, a devDependency.)

## Stack
- Next.js (App Router) — one codebase for UI + API routes
- PostgreSQL — AWS RDS to start, but stay portable: no AWS-proprietary services
  (Cognito, DynamoDB, Amplify) anywhere in the stack
- Auth.js (NextAuth) — email/password or magic link, sessions stored in Postgres
- Docker — for AWS App Runner/ECS Fargate now, and a clean exit to another host later

## Roles (full detail in the brief)
- **Viewer** — anonymous, public cases only.
- **Creator** — account; owns cases; edits **every field** on their own cases
  (see decision below); can toggle private/public and share a link; can open
  their own private cases and any public case — never another Creator's
  private case.
- **Admin** — everything a Creator can do, plus: full CRUD on all cases
  regardless of owner, role management at `/admin/users`, global field
  explanations, landing-page content, and case promotion.
- **DECISION (2026-07-18, resolves the earlier spec/code open question):** ALL
  fields are per-case editable by the case owner and admins — including the
  research-derived constants and RJC standard cost rows that were originally
  locked. The integrity control is the frozen `default_value` baseline
  (Philadelphia model, snapshotted at case creation), the changed-from-default
  flag, and the creator's annotation on each deviation — not field locks.
  The `creator_editable` flags in roi-model-fields.json are retained as
  documentation of the source spreadsheet's locks but gate nothing.

## Data model
`users`, `roi_cases`, `roi_case_fields`, `roi_case_versions` — see the brief for
full column definitions. Also: `field_explanations` + `content_blocks`
(admin-managed global overrides, fall back to roi-model-fields.json defaults),
`rate_limit_events` (magic-link send throttling), and the Auth.js tables
(`accounts`, `sessions`, `verification_tokens`). Two details that are easy to
get wrong:
- `roi_case_fields.default_value` is a snapshot frozen at case-creation time,
  never a live pointer to roi-model-fields.json.
- Version history is written only when a Creator publishes, not per edit.

## Build order (1–6 done; 7 remains)
1. ✅ Calculation engine as pure functions, no DB or UI yet. Test against
   `outputs_reference_values` in roi-model-fields.json — defaults in should
   produce IROI 6.14 / 11.03 / 15.34 (Low/Medium/High).
2. ✅ DB schema + migrations, against a local Postgres in Docker, not AWS yet.
3. ✅ Auth + roles + field-level permission enforcement (server-side, always).
4. ✅ Case CRUD + the privacy/sharing rules.
5. ✅ Publish/versioning.
6. ✅ Admin screens.
7. Deploy to AWS. (Blocker: production email is deliberately unimplemented —
   `sendVerificationRequest` in `src/auth.ts` throws unless `AUTH_EMAIL_SERVER`
   handling is wired to a real mailer.)

## Conventions
- TypeScript strict mode.
- Every permission check is enforced server-side — a client-side-only check
  isn't a real restriction.
- [Add naming/file-structure/style conventions here as the codebase forms.]

## Commands
- `npm run dev` — start the dev server (Next.js with Turbopack)
- `npm test` — run tests (Vitest, single pass)
- `npm run test:watch` — Vitest in watch mode
- `npm run lint` — ESLint
- `npm run build` — production build
- `npm run db:generate` — generate migration SQL from schema changes (drizzle-kit)
- `npm run db:migrate` — apply pending migrations to the database
- `npm run db:studio` — open Drizzle Studio (DB browser)
- `docker compose up -d` — start local Postgres (port 5432)
- `docker compose down` — stop local Postgres

## Auth (step 3 complete)
- **next-auth v4** (not v5) + `@auth/drizzle-adapter`
- Magic link provider — in dev, links log to the server console (no email sent).
  Set `AUTH_EMAIL_SERVER` + `AUTH_EMAIL_FROM` in prod to enable real email.
- Sessions stored in Postgres (`sessions` table). DB session strategy means
  middleware can only do cookie-presence checks, not role checks. Role enforcement
  for `/admin` is done server-side via `getServerSession(authOptions)` in layouts.
- `src/auth.ts` — auth config + `authOptions` export
- `src/types/next-auth.d.ts` — extends `Session["user"]` with `role`
- `src/proxy.ts` — Next.js 16 proxy (renamed from middleware). Guards
  `/dashboard/*` and `/admin/*` — unauthenticated users redirect to `/login`.
- `src/lib/auth/permissions.ts` — `canEditField(fieldKey, role)`,
  `isFieldPerCaseEditable(fieldKey)`, `assertCreator(session)`,
  `assertAdmin(session)`. Since the all-fields-editable decision these validate
  that the key is a real model field (`KNOWN_FIELD_KEYS`, derived at load time
  from `docs/roi-model-fields.json` — do not hardcode it); they no longer lock
  any field to any role.
- **Admin bootstrap**: no admin exists until one is promoted. To make the first
  admin, sign in via magic link then run:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
  ```
- **Rate limiting**: magic-link sends are throttled in `enforceSendRateLimit`
  (src/auth.ts) via `src/lib/rate-limit.ts` — sliding windows per-email, per-IP
  (only when a forwarded IP header exists), and global, backed by the
  `rate_limit_events` table.
- **`/go` dev shortcut**: the latest magic link is stashed in
  `/tmp/iroi-magic-link.txt`; visiting `/go` redirects to it. 404s in production.

## Case CRUD (step 4 complete)

### Case library (`src/lib/cases/`)
- `slug.ts` — `generateSlug()` (8-char base64url)
- `seed.ts` — `buildCaseFieldRows(caseId)` — 81 rows from DEFAULT_INPUTS + JSON notes
- `convert.ts` — `convertFieldsToInputs(fields)` — fields → typed `RoiInputs` (call this before `calculateRoi`)
- `access.ts` — `canViewCase()`, `canEditCase()`, `assertCanView()`, `assertCanEdit()`. Private cases → 404 for non-owners (don't leak existence).
- `field-meta.ts` — `FIELD_META` map (label + note per fieldKey) + `variableKeyOf()`
- `field-units.ts` — unit adornments ($/%/unit words) and the display↔storage % conversion (stored 0–1, entered 0–100): `toStoredValue()`, `toDisplayValue()`
- `field-explanations.ts` / `content-blocks.ts` — admin-managed global overrides for ⓘ tooltips and prose blocks; fall back to JSON defaults
- `snapshot.ts` — `buildSnapshot()`, `snapshotToFieldRows()`, `draftDiffersFromSnapshot()`
- `operations.ts` — case CRUD (`createCase()`, `getCaseBySlug()`, `getCaseFields()`, `listMyCases()`, `listPublicCases()`, `listPromotedCases()`, `updateCaseMeta()`, `deleteCase()`), field writes (`updateCaseField()`, `updateFieldGroup()`, `updateSplit()`), publish/versions (`publishCase()`, `restoreVersion()`, `listVersions()`, `getVersion()`, `getVersionById()`), admin (`setCasePromoted()`)

### Mutations are Server Actions only — no REST API routes
All mutations go through `src/app/actions/cases.ts` (case/field writes) and `src/app/actions/admin.ts` (admin ops). Each action calls `getServerSession(authOptions)` + `assertCreator/assertAdmin` itself — middleware does not protect server actions.

### Viewer access
Anonymous/non-owner access to `/case/[slug]` requires the case to be public AND have a live published version (`roi_cases.live_version_id` set) — see `canViewCase()`. Non-owners are rendered the live version's snapshot, never the draft. Otherwise: anonymous visitors get a login CTA, signed-in non-owners get a 404.

### Outcome split — saved as a group, renormalized
The three split fields cannot be written individually — `updateCaseField` rejects them; they go through `updateSplit()` (all three together). Server validates sum ≈ 100% within `SPLIT_SUM_TOLERANCE` (5e-4 in fraction units), then renormalizes so the stored triple sums to exactly 1, because the engine's own check uses a 1e-9 epsilon. The split shares ONE annotation, written to all three rows, read back from `resolution_pct`.

## Publish / versioning (step 5 complete)
- `publishCase()` snapshots the draft into an immutable `roi_case_versions` row (complete field copy — see `snapshot.ts`) and points `roi_cases.live_version_id` at it. Version numbers are max+1 per case, retried on unique collision.
- `restoreVersion()` copies a version's values+annotations back into the draft AND re-points `live_version_id` to that version. No new version is created.
- Public/viewer rendering always comes from the live version's snapshot, never `roi_case_fields`.
- Pages: `/case/[slug]/v/[n]` — read-only past version, owner/admin only (404 otherwise); `/s/[slug]` — shareable summary of the live version (IROI numbers + derivation).

## Admin screens (step 6 complete)
- `/admin/*` gate: `src/app/admin/layout.tsx` checks `role === 'admin'` server-side; non-admins get 404 (proxy only checks cookie presence).
- `/admin/users` — role management. `setUserRole()` (src/lib/users.ts) enforces the last-admin rule atomically in the WHERE clause; the action also blocks changing your own role.
- `/admin/fields` — global ⓘ explanation overrides (`field_explanations`).
- `/admin/content` — landing-page / section prose overrides (`content_blocks`).
- `/admin/promote` — feature cases on the public landing page (`promoted_at`; shown only while also public + published).

## Next.js 16 notes
- The route-protection file is `src/proxy.ts` (not `middleware.ts` — Next.js 16
  renamed the convention). The API is identical: default export + `config.matcher`.

## Don't
- Don't make CJS column D ("Cost Per Case") an editable field — it's a pure
  formula (units × cost/unit) per the source spreadsheet's own instruction.
- Don't let a Creator's edit to the RJC outcome split break the 100%
  constraint — auto-derive the locked third value instead of leaving it stale.
- Don't treat the duplicate expungement-earnings inputs (source spreadsheet
  cells B32/B52 and B33/B53) as two independent fields — one value, referenced
  twice by the calculation engine.
- Don't introduce AWS-proprietary services — it breaks the portability requirement.