// Runs before anything imports src/env.ts, which parses once at import time.
//
// The suite truncates every table it can reach, so it gets a database of its
// own. On this host DATABASE_URL points at a Postgres that also serves the
// deployment, and «the host is local» is not the safety property it looks like.
import '../src/load-env.js'

if (process.env['TEST_DATABASE_URL']) {
  process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL']
}

// Uploads land in a folder of their own, for the same reason the suite gets a
// database of its own: it writes and it deletes, and it should not do either
// where a developer or a deployment keeps other people's photographs. Set, not
// defaulted — .env names a real folder and it would win.
process.env['MEDIA_DIR'] = './data/media-test'
process.env['MEDIA_ORIGIN'] = 'http://test.local'
