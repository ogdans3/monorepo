# Build context is the repo root, because the web app shares packages/contract.
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contract/package.json packages/contract/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
ARG PUBLIC_APP_STORE_URL=""
ARG PUBLIC_PLAY_STORE_URL=""
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
