# Medusa backend, built from the workspace root so the shared packages resolve.
#
#   docker compose --profile full build backend
#
# Verified end to end on 2026-08-05 — image builds, starts against the compose
# Postgres and Redis, and answers /health and /app with 200 — but only with
# `--trust-lockfile` added to the install below. Without it pnpm's supply-chain
# check makes a registry request per lockfile entry (1184 of them) and npmjs.org
# 429s the build. That flag is a security decision, not a workaround, so it is
# not committed here until it is one someone has actually made.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
COPY packages/catalog/package.json packages/catalog/
# --network-concurrency is not tuning: npmjs.org 429s this dependency tree at
# pnpm's default of 16, and the whole install fails. 4 gets through.
RUN pnpm install --frozen-lockfile --network-concurrency=4 \
      --filter @redpoint/backend... --prod=false

# --- build ------------------------------------------------------------------
FROM deps AS build
COPY packages/catalog packages/catalog
COPY apps/backend apps/backend
RUN pnpm --filter @redpoint/catalog build
RUN pnpm --filter @redpoint/backend build

# --- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app

# The build output, not the source tree. Medusa resolves the admin bundle from
# <cwd>/public/admin, so started anywhere else it dies on "Could not find
# index.html" — see CLAUDE.md. Module resolution still climbs to /app/node_modules.
WORKDIR /app/apps/backend/.medusa/server

# Migrations are run explicitly rather than on boot, so a restart loop can
# never half-apply a schema change:
#   docker compose --profile full run --rm backend npx medusa db:migrate
EXPOSE 9000
CMD ["pnpm", "start"]
