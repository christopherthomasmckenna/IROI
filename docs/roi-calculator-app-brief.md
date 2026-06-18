# ROI Calculator Web App — Build Brief

## Roles

**Viewer** — anonymous, no account.
- Can browse and open *public* ROI cases.
- Cannot see private cases, even with a direct link.

**Creator** — authenticated account.
- Creates and edits their own ROI cases.
- Every field they change from its default can carry an annotation explaining the reasoning.
- Can toggle a case private or public.
- Can generate a shareable link to a case's results.
- Can open their own private cases and any public case. Cannot open another Creator's private case, even via a shared link.

**Admin** — authenticated account, all Creator permissions plus:
- Full CRUD on every case in the system, regardless of owner — including private cases owned by other Creators. Admin is the only role besides the owner that can see a private case at all.
- Can edit every field on any case, not just the subset Creators can edit — including the CJS percentage/cost-per-case columns, all RJC cost line items, and the 9 locked HP/RP/Community assumptions.

## Access rules

| Case state | Anonymous Viewer | Other Creator (not owner) | Owner | Admin |
|---|---|---|---|---|
| Public | View | View | View + Edit | View + Edit |
| Private | Blocked | Blocked | View + Edit | View + Edit |

A shared link only does meaningful work for public cases now — since private cases are blocked for everyone but the owner and Admin, having the link doesn't grant a non-owner Creator or anonymous Viewer any access they wouldn't already have.

This needs to be enforced server-side on every request — a client-side-only check isn't a real restriction, since anyone can inspect or bypass front-end code.

## Field-level edit permissions (Creator vs Admin)

Not every input is open to Creators. Per your spec, Creators can edit:

- **CJS Program Costs** (rows 13–19, all 7 line items): units required and cost/unit (columns B–C) only. The Low/Medium/High applicability percentages (F–H) and the computed cost-per-case (D) are locked for Creators — Admin-only.
- **RJC Program Costs**: only the case-outcome split's `preconferencing_only_pct` and `conferenced_unresolved_pct` (row 39, columns C–D). None of the 12 RJC cost line items (rows 11–22, plus the row-27 overhead variant) are Creator-editable.
- **HP, RP, Community Inputs**: 10 of the 19 fields — harmed parties per case, restitution per harmed party, transportation expense, loss of income, time/expense difference %, GED earnings increase, % obtaining GED, community service hours, community service $/hour, and % completing community service (rows 15, 18, 22, 23, 24, 28, 29, 43, 44, 45).

Everything else stays a fixed constant for Creators in this iteration, editable only by Admins. `roi-model-fields.json` now carries a `creator_editable: true/false` flag on every field to drive this. Since the permission is the same for every case (it's a property of the field definition, not the case data), it belongs in this schema file rather than as a column on `roi_case_fields` — the backend checks a Creator's edit request against this file's flags rather than storing per-case permission state.

Two things in the source spreadsheet are worth flagging before this gets built:

1. **CJS column D ("Cost Per Case") is explicitly marked do-not-edit in the sheet itself** (cell D10: "Do not enter new values in this column"), even though it falls inside the B–D range you listed. It's a pure formula (units × cost/unit). Recommend keeping it computed/read-only for both Creators and Admins rather than a stored editable field, matching the spreadsheet's own instruction — flag if you actually want it overridable.
2. **The RJC outcome split must sum to 100%** (the sheet's own instruction, cell A38), but locking `resolution_pct` (B39) for Creators while leaving `preconferencing_only_pct`/`conferenced_unresolved_pct` (C39/D39) open means a Creator's edits could break that constraint. Recommended fix: auto-derive `resolution_pct = 1 − preconferencing_only_pct − conferenced_unresolved_pct` whenever a Creator changes either field, rather than leaving it stale. Admins, who can edit all three directly, should get a validation warning rather than a silent override if their three values don't add up to 100%.

## Calculator inputs & logic (from source spreadsheet)

The spreadsheet is the "RJC Impact ROI Model" — a cost-benefit analysis comparing Restorative Justice Conferencing (RJC) programs to the Criminal Justice System (CJS), expressed as an Impact ROI (IROI) ratio. It's organized as a five-sheet calculation chain:

1. **CJS Program Costs** — 7 cost line items (prosecution, public defender, court operations, incarceration, supervision, etc.), each with editable units-required, cost-per-unit, and a Low/Medium/High applicability percentage. These roll up into a Total CJS Cost per Case at all three sensitivity levels.
2. **RJC Program Costs** — 12 cost line items (intake evaluation, pre-conferencing prep, facilitation, follow-up, overhead, etc.), each with editable hours-or-units and a rate. These are blended across three case-outcome paths (full resolution / pre-conferencing-only / conferenced-but-unresolved) using an editable percentage split that must sum to 100%, producing an RJC Average Cost per Case.
3. **HP, RP, Community Inputs** — roughly 17 standalone editable assumptions (restitution, lost income, GED-related earnings, expungement impact, incarceration avoidance, community service value, tax rate, recidivism reduction) plus the totals pulled automatically from sheets 1 and 2.
4. **Cost and Benefit Calculations** — combines sheet 3's inputs into four benefit totals: Harmed Party value, Responsible Party value, and Community value (the latter two vary by sensitivity level).
5. **Impact ROI** — the output sheet: Overall Benefit = (CJS cost − RJC cost) + (HP + RP + Community benefits), and IROI = Overall Benefit ÷ RJC cost, reported as Low/Medium/High ratios (currently 6.14 / 11.03 / 15.34) plus a breakdown by category at medium sensitivity (program savings, HP, RP, community).

In total there are roughly 80 editable numeric inputs across the three input sheets — too many to list inline here. They're fully enumerated, with their cell references, default values, labels, and sourcing notes, in the companion file **`roi-model-fields.json`**, which should be used directly as the seed data for default case values and the basis for the calculation engine's logic.

One data quirk worth fixing during the port: the spreadsheet duplicates the expungement-earnings input (used in both the RP benefit total and the tax-revenue benefit total) as two separate cells that happen to share the same default. In the new data model this should be a single field referenced twice by the calculation engine, not two fields that could silently drift out of sync.

## Data model (sketch)

- `users` — id, email, password hash, role (`creator` | `admin`), created_at
- `roi_cases` — id, owner_id, title, is_private, share_slug (unique), created_at, updated_at
- `roi_case_fields` — id, case_id, section_key (`cjs_program_costs` | `rjc_program_costs` | `hp_rp_community_inputs`), field_key (matching the ids in `roi-model-fields.json`), default_value, current_value, annotation (nullable) — one row per editable input (~80 per case), grouped by section so the UI can render the same three-section layout as the spreadsheet. Stores every field regardless of who can edit it, since fields locked for Creators still drive the calculation; the backend rejects a Creator's write to any field whose `creator_editable` flag is false in the schema, rather than omitting the field entirely. **`default_value` is a frozen snapshot taken at the moment the case is created** — a copy of whatever the system-wide defaults were at that instant, not a live pointer to `roi-model-fields.json`. If an Admin later changes a global default (say, the tax rate), that only affects cases created from then on; existing cases keep showing what their defaults actually were when they were initiated, so "changed from default" annotations stay meaningful and don't silently shift underneath a case.
- `roi_case_versions` — id, case_id, version_number, snapshot (a JSON copy of all fields/values/annotations at that moment), published_by, published_at

A Creator edits `roi_case_fields` freely as a draft. Hitting "Publish" copies that state into a new `roi_case_versions` row, so history only accumulates at publish points rather than on every keystroke. Viewers and shared links show the latest published version; a Creator's dashboard can list past versions for their own cases.

Computed ROI outputs can be derived on the fly from the field values rather than stored.

## Recommended stack (portable, AWS to start)

- **App framework:** Next.js (App Router) — one codebase for both UI and API routes; runs on Node anywhere or in a Docker container, so it isn't tied to AWS.
- **Database:** PostgreSQL, run via AWS RDS initially. Postgres is supported everywhere (Supabase, Neon, Render, DigitalOcean), so migrating later is mostly a connection-string change.
- **Auth:** Auth.js (NextAuth) with email/password or magic links, sessions stored in the same Postgres database. Avoids AWS-specific lock-in like Cognito.
- **Hosting:** Docker container, deployed on AWS (App Runner or ECS Fargate to start; even a single EC2 instance works for an MVP). Docker is what makes a future move to another host straightforward.
- **File storage:** S3, only if/when you need it (e.g. exporting a case as PDF) — not required for v1.

This deliberately skips AWS-proprietary managed services so the "may need to port later" requirement stays realistic, and keeps the whole thing to one app + one database, which is manageable for a single person.

## Suggested pages

- `/` — public list of public cases (Viewer-facing)
- `/case/[slug]` — view a case, enforcing the access rules above
- `/login`, `/signup` — Creator auth
- `/dashboard` — a Creator's own cases, create/edit/publish, and view past versions
- `/admin` — Admin-only, full case list with CRUD on everything
- `/admin/users` — Admin-only, promote or demote a user between Creator and Admin

## Resolved decisions

1. Private cases are visible only to their owner and Admins. Other Creators get the same access as anonymous Viewers — blocked, even with the link.
2. Admins get a simple role-management screen (`/admin/users`) to promote or demote users, rather than requiring direct database edits.
3. History is limited to snapshots taken when a Creator publishes — not a log of every field-level change.
4. Each case stores its full field set as a frozen snapshot from the moment it was created, separate from any later changes to system-wide defaults.

## Next step

This now needs a real backend, database, and AWS credential handling — beyond what a single page can do. Claude Code is the right tool to scaffold this directly inside your AWS-connected project, set up the database schema, build the role-based access logic, and handle deployment.
