# The Flutter app, built for the browser so every screen can be opened without a
# phone. The same lib/ that ships to iOS and Android; only the shell differs.
#
# The SDK is fetched rather than taken from a prebuilt Flutter image: those
# carry the whole Android toolchain, several gigabytes of it, and none of it is
# used to compile for the web. Pinned to the version this was written against,
# because `stable` drifts and a release that changes a lint would break a deploy
# nobody touched.
FROM debian:bookworm-slim AS flutter
ENV FLUTTER_VERSION=3.41.9
ENV FLUTTER_HOME=/opt/flutter
ENV PATH="$FLUTTER_HOME/bin:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates unzip xz-utils \
  && rm -rf /var/lib/apt/lists/*

# The .git directory stays: the flutter tool refuses to run without it, which
# is worth knowing before trying to save the space again.
RUN git clone --depth 1 --branch "$FLUTTER_VERSION" https://github.com/flutter/flutter.git "$FLUTTER_HOME" \
  && git config --global --add safe.directory "$FLUTTER_HOME" \
  && flutter config --no-analytics --no-cli-animations --enable-web \
  && flutter precache --web --no-android --no-ios --no-linux --no-macos --no-windows --no-fuchsia

FROM flutter AS build
WORKDIR /app

# The API origin is compiled into the bundle, so it is a build argument rather
# than an environment variable: there is no server here to read one at runtime.
ARG API_BASE=http://localhost:4001

COPY pubspec.yaml pubspec.lock ./
RUN flutter pub get

COPY . .
RUN flutter build web --release --dart-define=API_BASE=$API_BASE

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /srv
COPY --from=build /app/build/web ./public
COPY serve.js ./serve.js

USER node
EXPOSE 3000
CMD ["node", "serve.js"]
