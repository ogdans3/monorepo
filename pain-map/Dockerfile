# Two stages, per the conventions in /home/ai_user/git/README.md. The runtime
# image carries the adapter-node output and its production dependencies only.
FROM node:22-alpine AS build
WORKDIR /app
RUN npm i -g pnpm@10
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
# HOST must be 0.0.0.0: the dashboard reaches the container over the aicentral
# Docker network, not over loopback inside it.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["node", "build/index.js"]
