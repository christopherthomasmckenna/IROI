# Maintenance plan and watch-items (written 2026-07, horizon ≈ 18 months)

Audit of what this deployment needs to stay healthy. Effort labels:
**S** = minutes, **M** = an hour or two, **L** = a planned work session.

## Do now (within days–weeks)

1. **Off-box database backups — the only critical gap.** (M)
   All accounts and cases live in one Docker volume on one $6 droplet; there
   is currently no backup. Two layers, do both:
   - Turn on **DigitalOcean Backups** for the droplet (DO console → droplet →
     Backups → enable; ~$1.20/mo for weekly snapshots). One click, whole-box
     recovery.
   - A nightly `pg_dump` cron on the droplet copied off-box (see DEPLOY.md
     for the command). Weekly snapshots alone can lose up to a week of cases.
2. **Store the secrets somewhere durable.** (S)
   `.env.production` exists only on the droplet (plus Robb's staging copy).
   Put its contents in a password manager entry. Losing it means re-keying
   Brevo and resetting the DB password; it's a 10-minute recovery *if* the
   values are saved.
3. **Uptime monitoring.** (S)
   Nothing currently notices if the site goes down. A free checker
   (e.g. UptimeRobot) pinging https://rjcimpact.org every 5 minutes,
   emailing Chris and Robb, closes the loop.
4. **Second admin.** (S)
   One admin account is a bus-factor problem; promote a second once accounts
   exist.

## Quarterly rhythm (S–M each time)

- **Rebuild and redeploy even without code changes.** The three base images
  (`node:22-alpine`, `postgres:16-alpine`, `caddy:2-alpine`) accumulate
  security fixes that only land here on rebuild: run the standard deploy
  sequence from DEPLOY.md (`build` → `migrate` → `up -d`).
- **`npm audit` + minor/patch updates** (`npm outdated`), then tests: the
  spreadsheet-parity suite is the safety net that makes routine bumping
  low-risk. Drizzle (pre-1.0) moves fast; read its changelog before bumping.
- **Droplet OS patches:** Ubuntu applies security updates automatically, but
  kernel updates need a reboot — check `ls /var/run/reboot-required` and
  reboot in an idle moment (downtime ≈ 1 min; containers restart themselves).
- **Restore drill (twice a year is enough):** actually restore a `pg_dump`
  into a scratch database once. An untested backup is a hope, not a backup.

## Calendar items

- **Domain renewal (~July 2027):** confirm Porkbun auto-renew stays ON and
  the card on file is valid. An expired domain takes the site *and* sign-in
  email down at once. (S)
- **Brevo free tier:** 300 emails/day is ample for tire-kicking; revisit only
  if usage grows or Brevo nags about inactivity. (S)

## 6–12 months out

- **Node 22 → Node 24 LTS** (M). Node 22 leaves active support and enters
  maintenance-only; Node 24 is the current LTS. It's a one-line change in the
  Dockerfile (`FROM node:24-alpine`) plus dev machines, then full test run.
  Target early 2027 — Node 22 maintenance ends ~April 2027.
- **Next.js 16 → 17** (L, when it exists and has settled). Don't chase the
  release; adopt after a patch or two. Watch for the same kind of rename
  churn as 15→16's `middleware.ts` → `proxy.ts`.
- **If tire-kicking graduates toward real production** (L, decision + work):
  the single-droplet shape is fine for demos but has no redundancy. The
  portable stack makes the upgrade path mechanical: managed Postgres (or the
  original AWS plan), a bigger droplet, and the same containers. Trigger:
  real users depending on it, not calendar time.

## 12–18 months out

- **next-auth v4 → Auth.js v5** (L). v4 works but is in maintenance mode and
  will fall behind Next majors eventually. Our surface area is small
  (magic-link provider, drizzle adapter, `getServerSession` call sites,
  DB sessions), so this is a contained, well-trodden migration — schedule it
  rather than letting it schedule us, ideally alongside the Next 17 work.
- **Tailwind/React majors:** adopt opportunistically with the quarterly
  rhythm; nothing forces these.

## Non-issues (checked, no action needed)

- **TLS certificates** — Caddy renews Let's Encrypt automatically.
- **Rate-limit table growth** — self-pruning by design.
- **Postgres 16** — supported upstream until late 2028.
- **Ubuntu 24.04 LTS** — supported until 2029.
- **Session-table growth** — slow accumulation of expired rows; cosmetic;
  clear opportunistically during some quarterly pass.

## One standing process risk worth naming

**Model changes must move in lockstep.** The Excel workbook,
`roi-model-fields.json`, and the engine are three copies of one truth, and
the parity test enforces agreement for the *default* inputs only. If the
researchers ever revise the model: update workbook + JSON + engine together
in one commit, extend the parity test if new outputs appear, and remember
existing cases keep their frozen old defaults by design — decide explicitly
whether that's the desired behavior for the revision at hand.
