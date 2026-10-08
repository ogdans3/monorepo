import { createServer } from "node:http";
import { handler } from "./build/handler.js";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const server = createServer((request, response) => {
  // MP4s are already compressed. CDN transformations can strip Content-Length
  // and turn Safari's bytes=0-1 probe into a full 200 response instead of 206.
  if (/^\/previews\/[^?]+\.mp4(?:\?|$)/.test(request.url || "")) {
    response.setHeader("Cache-Control", "public, max-age=14400, no-transform");
    response.setHeader("Accept-Ranges", "bytes");
  }
  handler(request, response);
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
