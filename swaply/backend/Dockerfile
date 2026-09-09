# Build context is the project root, because the API depends on shared/.
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
COPY shared/package.json shared/
COPY backend/package.json backend/
# The workspace names web/ too, and pnpm wants to find it even to ignore it.
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter @swaply/shared --filter @swaply/backend

FROM deps AS build
COPY shared shared
COPY backend backend
RUN pnpm --filter @swaply/shared build && pnpm --filter @swaply/backend build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --prod --filter @swaply/shared --filter @swaply/backend
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/backend/dist backend/dist
# Migrations run at boot, so the image carries the SQL that matches it.
COPY backend/drizzle backend/drizzle

USER node
EXPOSE 3000
WORKDIR /app/backend
CMD ["node", "dist/server.js"]
