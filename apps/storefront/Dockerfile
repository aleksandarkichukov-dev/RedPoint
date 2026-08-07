# The Next.js storefront, built from the workspace root so the shared packages
# resolve.
#
#   docker compose --profile full build storefront
#
# NOT ON THE VPS. `next build` peaks around 2 GB and the server has 2 GB with
# the shop running in it. Build here or in CI, push the image, and let the VPS
# pull it — see docs/deploy.md. Nothing enforces that; it is a thing to know.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- dependencies -----------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/storefront/package.json apps/storefront/
COPY packages/catalog/package.json packages/catalog/
COPY packages/design-system/package.json packages/design-system/
# --network-concurrency is not tuning: npmjs.org 429s this dependency tree at
# pnpm's default of 16 and the whole install fails. 4 gets through.
#
# --trust-lockfile skips re-applying the supply-chain policy to each of the
# 1243 lockfile entries. That check makes one registry request per entry, and
# npmjs.org rate-limits it: the build died after 2m26s on "Lockfile failed
# supply-chain policy check". The policy still runs where there is something
# new to judge — on this machine, when a dependency is added or updated and the
# lockfile is rewritten. Inside the image the lockfile is the committed one,
# unchanged, and already installed from daily. Re-verifying it proves nothing
# the file being in git does not.
#
# The shop's decision, taken on 2026-08-07 after being told what it costs.
RUN pnpm install --frozen-lockfile --network-concurrency=4 --trust-lockfile \
      --filter @redpoint/storefront... --prod=false

# --- build ------------------------------------------------------------------
FROM deps AS build
COPY packages packages
COPY apps/storefront apps/storefront
RUN pnpm --filter @redpoint/catalog build

# No build arguments for the backend address or the publishable key. Both are
# read at run time (MEDUSA_BACKEND_URL, MEDUSA_PUBLISHABLE_KEY), which is what
# keeps this image portable: the key changes when the production database is
# seeded, and baking it in would turn that into a rebuild on a server that
# cannot build. See the note in src/lib/medusa.ts.
#
# SITE_URL is the exception, and not by choice. Next reads next.config.ts when
# it builds, so the list of hosts it will optimise images from is fixed in the
# bundle — a runtime value cannot reach it. Without this the shop serves every
# product photograph as a 400 while the same file downloads fine from /static,
# which is how the first deploy went.
#
# It does tie the image to one domain. That is the smaller cost: rebuilds
# happen off the server anyway, and the alternative is allowing the optimiser
# to fetch from any host at all.
ARG SITE_URL
ENV SITE_URL=$SITE_URL

RUN pnpm --filter @redpoint/storefront build

# --- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output: the server and only the files it imports. The three COPYs
# are the shape Next produces and all three are needed — the server alone
# serves pages with no CSS and no images, which looks like a broken stylesheet
# rather than a missing directory.
COPY --from=build /app/apps/storefront/.next/standalone ./
COPY --from=build /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build /app/apps/storefront/public ./apps/storefront/public

EXPOSE 3000
CMD ["node", "apps/storefront/server.js"]
