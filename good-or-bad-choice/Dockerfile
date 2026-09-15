# One image: the Flutter app compiled for the browser, and the Node server that
# serves both it and the API.
#
# No BuildKit-only syntax anywhere in here. The dashboard's docker CLI has no
# buildx and falls back to the classic builder, which fails outright on
# `RUN --mount`.

# ---------------------------------------------------------------------------
# The browser build.
#
# The SDK is fetched rather than taken from a prebuilt Flutter image: those
# carry the whole Android toolchain, several gigabytes of it, and none of it is
# used to compile for the web. Pinned, because `stable` drifts and a release
# that changes a lint would break a deploy nobody touched.
# ---------------------------------------------------------------------------
FROM debian:bookworm-slim AS flutter
ENV FLUTTER_VERSION=3.41.9
ENV FLUTTER_HOME=/opt/flutter
ENV PATH="$FLUTTER_HOME/bin:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates unzip xz-utils \
  && rm -rf /var/lib/apt/lists/*

# The .git directory stays: the flutter tool refuses to run without it, which is
# worth knowing before trying to save the space again.
RUN git clone --depth 1 --branch "$FLUTTER_VERSION" https://github.com/flutter/flutter.git "$FLUTTER_HOME" \
  && git config --global --add safe.directory "$FLUTTER_HOME" \
  && flutter config --no-analytics --no-cli-animations --enable-web \
  && flutter precache --web --no-android --no-ios --no-linux --no-macos --no-windows --no-fuchsia

FROM flutter AS app
WORKDIR /app
COPY app/pubspec.yaml app/pubspec.lock ./
RUN flutter pub get
COPY app/ ./
# No --dart-define for the API origin. The client calls the same origin it was
# served from, which is the whole reason these two live in one container.
RUN flutter build web --release

# ---------------------------------------------------------------------------
# The server.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS api
WORKDIR /srv
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/tsconfig.json ./
COPY api/src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /srv

COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=api /srv/dist ./dist
# The schema travels with the image that expects it, so MIGRATE_ON_BOOT has
# something to apply.
COPY api/migrations ./migrations
COPY --from=app /app/build/web ./public

USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
