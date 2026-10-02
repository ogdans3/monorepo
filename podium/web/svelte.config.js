import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: vitePreprocess(),
	kit: {
		// One shell, routed in the browser, and served by the Go server with
		// the API beside it: there is nothing to render on a server, since
		// everything on screen is live.
		adapter: adapter({ pages: 'build', assets: 'build', fallback: 'index.html', strict: false })
	}
};
