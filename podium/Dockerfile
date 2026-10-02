# One image: the Svelte app built, then embedded in the Go server, which
# serves it beside the API. Build from this folder: docker compose up --build.

FROM node:22-alpine AS web
WORKDIR /web
RUN npm install -g pnpm@10.33.2
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

FROM golang:1.27.1-alpine AS server
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=web /web/build ./webdist/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /podium ./cmd/podium

FROM alpine:3.22
# The media folder belongs to the user the server runs as, so a new volume
# mounted on it does too.
RUN adduser -D -H -u 10001 podium && mkdir -p /data/media && chown podium:podium /data/media
COPY --from=server /podium /usr/local/bin/podium
USER podium
ENV PORT=8080 MEDIA_DIR=/data/media
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s \
	CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
ENTRYPOINT ["podium"]
