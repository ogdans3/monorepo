FROM golang:1.24-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /studio ./cmd/server
FROM alpine:3.21
RUN apk add --no-cache ca-certificates python3 py3-pip ffmpeg tesseract-ocr tesseract-ocr-data-nor tesseract-ocr-data-eng && adduser -D -u 10001 studio && mkdir -p /data/files && chown studio /data/files
COPY importer /app/importer
RUN python3 -m venv /opt/importer && /opt/importer/bin/pip install --no-cache-dir -r /app/importer/requirements.txt
COPY --from=build /studio /usr/local/bin/studio
USER studio
EXPOSE 8088
ENTRYPOINT ["studio"]
