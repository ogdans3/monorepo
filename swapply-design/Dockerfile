FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000

# No dependencies — the site is static files plus a small node server.
COPY package.json server.js ./
COPY public ./public

EXPOSE 3000
CMD ["node", "server.js"]
