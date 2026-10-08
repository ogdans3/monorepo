# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build the SvelteKit app (ensure @sveltejs/adapter-node is configured)
COPY . .
RUN npm run build

# Keep only production deps for runtime image
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Copy only what's needed to run the Node adapter output
COPY --from=builder /app/build ./build
COPY --from=builder /app/server.mjs ./server.mjs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Run as non-root
USER node

# Start SvelteKit with the preview-video delivery headers.
CMD ["node", "server.mjs"]
