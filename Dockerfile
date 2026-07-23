# Production image for the IROI calculator (Next.js standalone).
#
#   build:   docker compose -f docker-compose.prod.yml build
#   run:     docker compose -f docker-compose.prod.yml up -d
#
# Stage layout:
#   deps     — full npm install (cached until package-lock changes)
#   builder  — next build (standalone output)
#   migrate  — full toolchain + drizzle migrations; run once per deploy
#   runner   — slim runtime: standalone server + static assets only

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL is not needed at build time — every page is dynamic — but the
# db module throws if it's unset when imported, so give the build a dummy.
ENV DATABASE_URL="postgres://build:build@localhost:5432/build"
RUN npm run build

# One-shot migration runner: `docker compose run --rm migrate`
# (drizzle-kit is a devDependency, so this stage keeps the full node_modules)
FROM node:22-alpine AS migrate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY docs/roi-model-fields.json ./docs/roi-model-fields.json
COPY src/lib/db ./src/lib/db
CMD ["npx", "drizzle-kit", "migrate"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
