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

## Stack
- Next.js (App Router) — one codebase for UI + API routes
- PostgreSQL — AWS RDS to start, but stay portable: no AWS-proprietary services
  (Cognito, DynamoDB, Amplify) anywhere in the stack
- Auth.js (NextAuth) — email/password or magic link, sessions stored in Postgres
- Docker — for AWS App Runner/ECS Fargate now, and a clean exit to another host later

## Roles (full detail in the brief)
- **Viewer** — anonymous, public cases only.
- **Creator** — account; owns cases; edits only fields flagged
  `creator_editable: true` in roi-model-fields.json; can toggle private/public
  and share a link; can open their own private cases and any public case —
  never another Creator's private case.
- **Admin** — everything a Creator can do, plus: edit every field on any case
  (not just the creator-editable subset), full CRUD on all cases regardless of
  owner, and role management at `/admin/users`.

## Data model
`users`, `roi_cases`, `roi_case_fields`, `roi_case_versions` — see the brief for
full column definitions. Two details that are easy to get wrong:
- `roi_case_fields.default_value` is a snapshot frozen at case-creation time,
  never a live pointer to roi-model-fields.json.
- Version history is written only when a Creator publishes, not per edit.

## Build order
1. Calculation engine as pure functions, no DB or UI yet. Test against
   `outputs_reference_values` in roi-model-fields.json — defaults in should
   produce IROI 6.14 / 11.03 / 15.34 (Low/Medium/High).
2. DB schema + migrations, against a local Postgres in Docker, not AWS yet.
3. Auth + roles + field-level permission enforcement (server-side, always).
4. Case CRUD + the privacy/sharing rules.
5. Publish/versioning.
6. Admin screens.
7. Deploy to AWS.

## Conventions
- TypeScript strict mode.
- Every permission check is enforced server-side — a client-side-only check
  isn't a real restriction.
- [Add naming/file-structure/style conventions here as the codebase forms.]

## Commands
- `npm run dev` — start the dev server
- `npm test` — run tests
- [Fill in once package.json exists.]

## Don't
- Don't make CJS column D ("Cost Per Case") an editable field — it's a pure
  formula (units × cost/unit) per the source spreadsheet's own instruction.
- Don't let a Creator's edit to the RJC outcome split break the 100%
  constraint — auto-derive the locked third value instead of leaving it stale.
- Don't treat the duplicate expungement-earnings inputs (source spreadsheet
  cells B32/B52 and B33/B53) as two independent fields — one value, referenced
  twice by the calculation engine.
- Don't introduce AWS-proprietary services — it breaks the portability requirement.