# Build context is the repo root, because the web app shares packages/contract.
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
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS build
# Baked in at build time: the client calls this origin and the Content Security
# Policy names it. They have to be the same value, so they come from one place.
ARG PUBLIC_API_ORIGIN="http://localhost:4000"
ARG PUBLIC_APP_STORE_URL=""
ARG PUBLIC_PLAY_STORE_URL=""
ENV PUBLIC_API_ORIGIN=$PUBLIC_API_ORIGIN
ENV PUBLIC_APP_STORE_URL=$PUBLIC_APP_STORE_URL
ENV PUBLIC_PLAY_STORE_URL=$PUBLIC_PLAY_STORE_URL
COPY packages/contract packages/contract
COPY apps/web apps/web
RUN pnpm --filter @checkpost/contract build && pnpm --filter @checkpost/web build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/apps/web/build ./build
COPY --from=build /app/apps/web/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

USER node
EXPOSE 3000
CMD ["node", "build/index.js"]
