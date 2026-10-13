# One small image: the Go server with the page built in. Build from this
# folder: docker build -t testpublikum .

FROM golang:1.27.1-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY *.go ./
COPY ui/ ./ui/
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /testpublikum .

FROM alpine:3.22
# The phones talk to Podium over HTTPS, so the image needs the CAs.
RUN apk add --no-cache ca-certificates && adduser -D -H -u 10001 testpublikum
COPY --from=build /testpublikum /usr/local/bin/testpublikum
USER testpublikum
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s \
	CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
ENTRYPOINT ["testpublikum"]
