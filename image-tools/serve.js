/**
 * The production entrypoint, in place of adapter-node's own `build/index.js`.
 *
 * It exists for one reason: the adapter sends no `cache-control` header on
 * anything except `/_app/immutable/`, and there is no configuration option to
 * change that. Prerendered pages and everything in `static/` are served
 * straight off disk by the adapter's own middleware, before any SvelteKit hook
 * runs, so the header cannot be set from inside the app either. Wrapping the
 * adapter's exported `handler` is the documented way in.
 *
 * See `cache-policy.js` for the policy itself. Setting the header before
 * delegating is what makes this work: `writeHead` merges whatever is already on
 * the response, and the adapter overwrites this header only for the immutable
 * assets, where it says the same thing anyway.
 *
 * What is deliberately not carried over from `build/index.js`: systemd socket
 * activation, the idle timeout and the keep-alive and headers timeout knobs.
 * Nothing sets them here, and this runs as one container behind Traefik.
 * ORIGIN and the rest of the request handling live inside `handler`, untouched.
 */
import { createServer } from 'node:http';
import process from 'node:process';
import { handler } from './build/handler.js';
import { cacheControlFor } from './cache-policy.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const server = createServer((req, res) => {
	res.setHeader('cache-control', cacheControlFor(req.url ?? '/'));
	handler(req, res, () => {
		// The SvelteKit handler answers everything, including its own 404 page,
		// so reaching here means a request it could not parse at all.
		res.statusCode = 404;
		res.end('Not found');
	});
});

server.listen(port, host, () => {
	console.log(`Listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		server.closeIdleConnections();
		server.close(() => process.exit(0));
	});
}
