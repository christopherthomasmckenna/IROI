# Deploying the IROI calculator

Target shape: one small VPS (Ubuntu LTS, ~1–2 GB RAM) running the Docker
Compose stack in `docker-compose.prod.yml` — Caddy (auto-HTTPS) → Next.js app →
Postgres. Nothing host-specific: any box that runs Docker works.

## Prerequisites

- A VPS with ports 22/80/443 open and an SSH key installed
- DNS: an A record pointing the site domain (e.g. `rjcimpact.org`) at the VPS IP
- Brevo (or any SMTP): domain verified (DKIM/SPF records added at the
  registrar), SMTP key in hand

## First deploy

```bash
# on the VPS (as root or sudo)
curl -fsSL https://get.docker.com | sh

git clone https://github.com/christopherthomasmckenna/IROI.git
cd IROI
cp .env.production.example .env.production
# fill in every value — see comments in the file
$EDITOR .env.production

docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Caddy obtains the TLS certificate automatically on first request (DNS must
already point here). Then create the first admin: sign in once via magic link,
and run:

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U iroi -d iroi -c "UPDATE users SET role='admin' WHERE email='chris.mckenna@gmail.com';"
```

## Updating to a new version

```bash
cd IROI
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

(`migrate` is a no-op when there are no new migrations.)

## Backups

The database lives in the `postgres_data` volume. Nightly dump:

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U iroi iroi | gzip > backup-$(date +%F).sql.gz
```

Cron it and copy the file off-box (scp/rclone). Restore:
`gunzip -c backup.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U iroi iroi`

## Notes

- **DigitalOcean blocks outbound SMTP ports 25/465/587 on new accounts** (learned
  in production 2026-07-24: `Connection timeout` from nodemailer while the same
  credentials worked elsewhere). Brevo's port **2525** is open and is what
  `AUTH_EMAIL_SERVER` uses: `smtp://...@smtp-relay.brevo.com:2525`.

- Postgres is not exposed to the host/internet — only the app container
  reaches it on the compose network.
- The magic-link rate limiter reads the client IP from `X-Forwarded-For`,
  which Caddy sets automatically.
- `/go` (dev sign-in shortcut) is disabled in production builds.
