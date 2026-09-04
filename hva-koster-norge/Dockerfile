# Build
FROM node:22-alpine AS build
WORKDIR /app
RUN npm i -g pnpm@10
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime — adapter-node output is self-contained.
FROM node:22-alpine
WORKDIR /app
# HOST and PORT are adapter-node's own defaults, set explicitly because the
# dashboard reaches the container over the aicentral bridge network rather
# than loopback. A server bound to 127.0.0.1 is unreachable there, and the
# failure looks like a build that worked and a site that will not load.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/build ./build
EXPOSE 3000
CMD ["node", "build/index.js"]
