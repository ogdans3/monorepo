#!/usr/bin/env bash
# Builds Swaply for the stores with a build number nobody has to remember to
# raise.
#
#   tool/release.sh android   the app bundle for Google Play
#   tool/release.sh ios       an archive for TestFlight, and the .ipa from it
#   tool/release.sh number    prints the number and builds nothing
#
# The build number is how many commits the repository has up to the one being
# built. Both stores refuse a number they have had before, a build that was
# never rolled out included. Every commit is one more than the last, so the
# number only ever goes up, and one commit is one number on Android and on
# iOS. The `+1` in `version:` in pubspec.yaml is what this replaces; the name
# in front of it, 1.0.0, is still read from there.
#
# It runs on the Mac that holds the keys and only builds. Uploading stays by
# hand, in Play Console and in Xcode. Written for the bash a Mac ships with,
# which is 3.2.
set -euo pipefail

case "${1:-}" in
  android | ios | number) ;;
  *)
    echo "Usage: tool/release.sh android|ios|number" >&2
    exit 64
    ;;
esac

cd "$(dirname "$0")/.."

# A shallow clone counts only the commits it fetched, and the number would go
# down.
if [ "$(git rev-parse --is-shallow-repository)" = true ]; then
  echo "This clone is shallow, so it cannot count the repository's commits." >&2
  echo "Run git fetch --unshallow, then try again." >&2
  exit 1
fi

number=$(git rev-list --count HEAD)

if [ "${1:-}" = number ]; then
  echo "$number"
  exit 0
fi

echo "Build $number, from $(git rev-parse --short HEAD)."
# Changes that are not committed are built under the number of the commit
# beneath them. That is fine for a try-out, and a store that already has the
# number refuses the upload.
if [ -n "$(git status --porcelain -- .)" ]; then
  echo "Note: app/ has changes that are not committed. They go out as build" \
    "$number too, and a store that already has $number will refuse it." >&2
fi

case "$1" in
  android)
    flutter build appbundle --release --build-number="$number"
    ;;
  ios)
    # One command from the archive to the .ipa. An archive made from Xcode's
    # menu instead carries whatever number the last flutter command wrote,
    # which after a `flutter run` is pubspec.yaml's `+1` again.
    status=0
    flutter build ipa --release --build-number="$number" || status=$?
    if [ -d build/ios/archive/Runner.xcarchive ]; then
      echo "To send it to TestFlight: open build/ios/archive/Runner.xcarchive," \
        "which opens Xcode's Organizer, and press Distribute App."
    fi
    exit "$status"
    ;;
esac
