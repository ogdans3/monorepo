# Build context is the project root, because the site depends on shared/.
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# No BuildKit cache mounts anywhere in here, for the same reason as the API
# image: a host whose docker CLI has no buildx fails outright on `RUN --mount`.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/
COPY web/package.json web/
# The workspace names backend/ too, and pnpm wants to find it even to ignore it.
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --filter @swaply/shared --filter @swaply/web

FROM deps AS build
COPY shared shared
COPY web web
RUN pnpm --filter @swaply/shared build && pnpm --filter @swaply/web build

# adapter-node emits a self-contained server that carries what it needs, so the
# runtime image has no install step and no node_modules to speak of.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/web/build web/build
COPY --from=build /app/web/package.json web/

USER node
EXPOSE 3000
ENV PORT=3000
WORKDIR /app/web
CMD ["node", "build/index.js"]
