#!/usr/bin/env sh
# Test-only fallback when the host lacks the media tools in Studio's API image.
set -eu
binary=$(basename "$0")
case "$binary" in ffmpeg|ffprobe|tesseract) ;; *) exit 2 ;; esac
exec docker run --rm --network none --user "$(id -u):$(id -g)" \
  -v "${STORAGE_PATH:?}:$STORAGE_PATH" --entrypoint "$binary" studio-api "$@"
