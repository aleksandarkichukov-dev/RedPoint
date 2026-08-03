# Medusa backend, built from the workspace root so the shared packages resolve.
#
#   docker compose --profile full build backend
#
# NOT YET VERIFIED: Docker is not installed on the development machine, so this
# has never been built.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
COPY packages/catalog/package.json packages/catalog/
RUN pnpm install --frozen-lockfile --filter @redpoint/backend... --prod=false

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
WORKDIR /app/apps/backend

# Migrations are run explicitly rather than on boot, so a restart loop can
# never half-apply a schema change:
#   docker compose --profile full run --rm backend npx medusa db:migrate
EXPOSE 9000
CMD ["pnpm", "start"]
