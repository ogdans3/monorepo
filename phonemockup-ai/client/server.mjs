import { createServer } from "node:http";
import { handler } from "./build/handler.js";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

// sirv, which serves the static files, hands the byte range straight to
// fs.createReadStream. An inverted range (bytes=5-1) or an end past
// Number.MAX_SAFE_INTEGER makes that throw, and the throw ended the process.
// A Range header that isn't a single plain bytes=start-[end] is ignored, as
// RFC 9110 allows, and the whole file is sent.
function dropUnusableRange(request) {
  const range = request.headers.range;
  if (range === undefined) return;
  const match = /^bytes=(\d{1,15})-(\d{0,15})$/.exec(range.trim());
  if (
    !match ||
    (match[2] !== "" && Number(match[2]) < Number(match[1])) ||
    // sirv reads an end of 0 as "to the end" and sends the whole file as
    // if it were the one byte asked for.
    (match[2] !== "" && Number(match[2]) === 0) ||
    // sirv doesn't check If-Range; sending the whole file is always right.
    request.headers["if-range"] !== undefined
  ) {
    delete request.headers.range;
  }
}

const server = createServer((request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // The studio and the saved projects are app pages, served as an empty
  // shell: say noindex before any script runs. The motion library stays.
  if (/^\/platform\/(animation\/[^/?#]+|project)(\/|\?|$)/.test(request.url || "")) {
    response.setHeader("X-Robots-Tag", "noindex");
  }
  // MP4s are already compressed. CDN transformations can strip Content-Length
  // and turn Safari's bytes=0-1 probe into a full 200 response instead of 206.
  if (/^\/previews\/[^?]+\.mp4(?:\?|$)/.test(request.url || "")) {
    response.setHeader("Cache-Control", "public, max-age=14400, no-transform");
    response.setHeader("Accept-Ranges", "bytes");
  }
  dropUnusableRange(request);
  try {
    handler(request, response);
  } catch (error) {
    // One bad request must not take the server down for everyone.
    console.error(error);
    if (response.headersSent) response.destroy();
    else {
      response.statusCode = 500;
      response.end();
    }
  }
});
server.listen(port, host, () =>
  console.log(`Listening on http://${host}:${port}`),
);

function shutdown() {
  server.closeIdleConnections();
  const timeout = setTimeout(() => server.closeAllConnections(), 30_000);
  timeout.unref();
  server.close(() => {
    clearTimeout(timeout);
    process.emit("sveltekit:shutdown");
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
