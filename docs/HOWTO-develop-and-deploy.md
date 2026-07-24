# How to change the calculator and deploy it

*Audience: Chris, or any developer working on the project later. The live site
is https://rjcimpact.org, running on a DigitalOcean droplet from this GitHub
repository (`christopherthomasmckenna/IROI`).*

## First: does your change even need code?

Much of the site is editable from the admin screens, live, with no deployment:

| You want to change… | Go to |
|---|---|
| Field guidance (hints, "About this input" text) | `/admin/fields` |
| Landing-page copy, section instructions | `/admin/content` |
| Which cases are featured on the landing page | `/admin/promote` |
| Who has accounts / who is admin | `/admin/users` |

Only behavior, layout, or the calculation model itself require the code path
below.

## The code path, end to end

### 1. Make and test the change locally

On a machine with the repo cloned (see README for first-time setup):

```bash
cd IROI
git pull                       # start from the latest code
# … edit files …
npm test                       # 66 tests, including spreadsheet parity —
                               # the math must still match the Excel model
npm run lint
npm run dev                    # try it in the browser at localhost:3000
```

The **spreadsheet parity test** is the project's guardrail: if a change makes
the engine disagree with `docs/IROI_IMPACT_MODEL.xlsx`, the tests fail. Never
skip the test run, and never change the math and the spreadsheet independently.

### 2. Commit and push to GitHub

```bash
git add -A
git commit -m "Short description of what changed and why"
git push
```

If `git pull` ever refuses because of `package-lock.json`, run
`git checkout -- package-lock.json` first (harmless — it's formatting drift
from different npm versions).

### 3. Deploy to the live server

Deploying means: log into the server, pull the new code, rebuild, restart.
Two ways to log in:

- **DigitalOcean web console (no setup needed):** log into digitalocean.com →
  Droplets → `iroi` → **Access** → **Launch Droplet Console**. A terminal
  opens in your browser, already logged in as root.
- **SSH (for developers):** `ssh root@64.227.11.196` from a machine whose SSH
  key is installed on the droplet.

Then, in that terminal, run exactly this:

```bash
cd IROI
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

- The `build` step takes 5–15 minutes on this small server. That's normal.
- `migrate` applies any database schema changes; it's an instant no-op when
  there are none. Running it every time is safe and correct.
- `up -d` swaps in the new version. Total downtime is a few seconds.
- The site should respond at https://rjcimpact.org immediately after; if you
  changed pages, hard-refresh your browser (Cmd-Shift-R).

### Rules of the road

- **Never edit files directly on the server.** The droplet's copy of the code
  must always be exactly what's on GitHub — that's what makes the server
  disposable and the deployment repeatable. Code flows one way:
  laptop → GitHub → server.
- **`.env.production` on the server is the exception** — it holds the secrets
  (database password, email credentials) and is deliberately NOT in git.
  Don't delete it; back it up somewhere private (password manager).
- If a deploy goes wrong, the previous images still exist — ask a developer
  (or the AI assistant Robb works with) before improvising on the server.

## What runs where (mental model)

```
GitHub repo  ──git pull──▶  DigitalOcean droplet (64.227.11.196)
                              ├─ caddy    (HTTPS, certificate auto-renews)
                              ├─ app      (the calculator, Next.js)
                              └─ db       (PostgreSQL — all accounts & cases)
Porkbun DNS: rjcimpact.org ─▶ droplet IP
Brevo: sends the sign-in emails (SMTP, port 2525)
```

The full deployment reference (first-time setup, backups, restore) is in
`DEPLOY.md` at the repo root.
