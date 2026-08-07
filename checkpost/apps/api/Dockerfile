# Build context is the repo root, because the API depends on packages/contract.
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# No BuildKit cache mounts anywhere in here. They save a few seconds and cost
# portability: a host whose docker CLI has no buildx falls back to the classic
# builder, which fails outright on `RUN --mount`. This has to build anywhere.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contract/package.json packages/contract/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/contract packages/contract
COPY apps/api apps/api
RUN pnpm --filter @checkpost/contract build && pnpm --filter @checkpost/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contract/package.json packages/contract/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/packages/contract/dist packages/contract/dist
COPY --from=build /app/apps/api/dist apps/api/dist
# Migrations are applied at boot. The image carries the SQL that matches it.
COPY apps/api/drizzle apps/api/drizzle

USER node
EXPOSE 3000
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
