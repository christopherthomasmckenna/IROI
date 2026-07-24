# IROI — RJC Impact ROI Calculator

A web application that computes the **Impact Return on Investment** of
Restorative Justice Conferencing (RJC) versus traditional Criminal Justice
System (CJS) case processing. It ports the research team's Excel model
(`docs/IROI_IMPACT_MODEL.xlsx`) into an interactive site where each
jurisdiction can build a **case**: localize any of the model's 81 inputs,
annotate every deviation from the original Philadelphia defaults, publish
immutable versions, and share results as a web summary or PDF.

**Live site:** https://rjcimpact.org

## How it fits together

- **Cases** — a case is one jurisdiction's version of the model. Creating a
  case freezes the Philadelphia defaults as its permanent comparison baseline;
  every changed input is flagged and carries the author's note.
- **Publishing** — edits are private drafting. Publishing snapshots the case
  into an immutable version; the public only ever sees the published version
  of a public case. Version history supports view and restore.
- **Sharing** — each published case has a summary page (`/s/<slug>`) with the
  headline numbers, a provenance brief (every deviation vs. defaults), the
  derivation table, and a **Download PDF** export.
- **Roles** — anonymous viewers see public published cases; signed-in creators
  own and edit their cases (all fields editable; integrity comes from the
  frozen baseline + annotations); admins manage all cases, users, field
  guidance, and site content at `/admin`.
- **Ground truth** — the Excel model is authoritative for the math. An
  automated test reads the workbook's output cells and fails if the code
  disagrees (`src/lib/calculator/__tests__/spreadsheet-parity.test.ts`).

## Stack and dependencies

Runtime (in `dependencies`):

| Package | Role |
|---|---|
| `next` (16.x) | Framework: server-rendered React pages + server actions (all mutations) |
| `react` / `react-dom` (19.x) | UI |
| `next-auth` (v4) + `@auth/drizzle-adapter` | Passwordless magic-link auth; sessions in Postgres |
| `drizzle-orm` | Typed SQL / schema / query layer over Postgres |
| `postgres` | The Postgres wire client drizzle rides on |
| `nodemailer` | Sends magic-link email over SMTP (Brevo) in production |
| `@react-pdf/renderer` | Server-side PDF export of published summaries |
| `react-markdown` + `remark-gfm` | Renders admin-authored field guidance (links, bold, lists) |

Development-only (in `devDependencies`):

| Package | Role |
|---|---|
| `drizzle-kit` | Generates and applies database migrations |
| `vitest` + `vite-tsconfig-paths` + `@vitejs/plugin-react` | Test runner |
| `exceljs` | Reads the source Excel workbook in the parity test |
| `typescript` (strict), `eslint` + `eslint-config-next` | Types + lint |
| `tailwindcss` v4 + `@tailwindcss/postcss` | Styling |
| `dotenv` | Env loading for drizzle-kit |

Infrastructure: **PostgreSQL 16** (Docker), **Caddy 2** (TLS termination in
production), **Node 22**, **Docker / Compose** for both the local database and
the entire production stack. Email delivery via **Brevo** SMTP (port 2525 —
see DEPLOY.md). No cloud-proprietary services anywhere; the stack runs on any
Docker host.

## Local development

```bash
git clone https://github.com/christopherthomasmckenna/IROI.git && cd IROI
npm install
cp .env.example .env.local        # fill in: DATABASE_URL (as-is for local),
                                  # NEXTAUTH_SECRET (openssl rand -base64 32),
                                  # NEXTAUTH_URL=http://localhost:3000
docker compose up -d              # local Postgres on :5432
npm run db:migrate                # create tables
npm run dev                       # http://localhost:3000
```

Sign-in in dev sends no email: request a link at `/login`, then visit `/go`
(or copy the link from the terminal). First admin: sign in once, then
`docker compose exec db psql -U iroi -d iroi -c "UPDATE users SET role='admin' WHERE email='you@example.com';"`

Commands: `npm test` (Vitest, includes spreadsheet parity) · `npm run lint` ·
`npm run build` · `npm run db:generate` (new migration from schema changes) ·
`npm run db:studio` (DB browser).

## Repository map

```
docs/
  IROI_IMPACT_MODEL.xlsx        ← the source spreadsheet (ground truth)
  roi-model-fields.json         ← every input: cell ref, default, notes
  roi-calculator-app-brief.md   ← product brief: roles, access rules
  HOWTO-develop-and-deploy.md   ← change → push → deploy walkthrough
  MAINTENANCE.md                ← upkeep schedule and watch-items
  research/                     ← tooltip UX + cost-benefit explainer docs
src/
  lib/calculator/               ← the pure calculation engine + tests
  lib/cases/                    ← case CRUD, snapshots, deviations, guidance
  lib/auth/, auth.ts, proxy.ts  ← permissions, next-auth config, route guard
  lib/pdf/                      ← PDF document for the summary export
  app/                          ← pages: landing, dashboard, case, summary, admin
drizzle/                        ← generated SQL migrations
Dockerfile, docker-compose.prod.yml, Caddyfile, DEPLOY.md  ← production
claude.md                       ← working notes / conventions for AI-assisted dev
```

## Deployment

See `DEPLOY.md` (first deploy, updates, backups) and
`docs/HOWTO-develop-and-deploy.md` (the everyday change→deploy loop).
Production runs the Compose stack in `docker-compose.prod.yml`: Caddy → app →
Postgres on a single small VPS, configured entirely by `.env.production`.
