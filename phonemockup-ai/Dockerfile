FROM node:22-alpine AS build
WORKDIR /app

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# This Dockerfile serves the freelunch.no development preview. This publishable
# key is public browser configuration for the existing PhoneMockup Clerk app.
# Real production uses client/Dockerfile and an injected production key.
ARG CLERK_PUBLISHABLE_KEY=pk_test_Y2xvc2luZy1tYW4tMTc3OC5jbGVyay5hY2NvdW50cy5kZXYk
ENV CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}

COPY --from=build /app/build ./build
COPY --from=build /app/server.mjs ./server.mjs
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
