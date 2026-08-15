import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

/**
 * The ffmpeg core is 32MB of WebAssembly, which has no business in git. It is
 * copied out of node_modules into static/ffmpeg/ at the start of every build
 * and dev run, so a fresh clone plus install produces it and nobody has to
 * remember a step. static/ffmpeg is gitignored.
 *
 * The ESM build, not the UMD one. ffmpeg spawns its worker with
 * type: "module", where importScripts does not exist, so its loader falls
 * through to a dynamic import and needs a core with a default export. Feed it
 * the UMD build and it fails at runtime with "failed to import
 * ffmpeg-core.js", which names the file but not the reason.
 */
function ffmpegCore(): Plugin {
	return {
		name: 'copy-ffmpeg-core',
		buildStart() {
			// Resolve through the package's own exports map rather than its
			// package.json, which it deliberately does not expose. That gives
			// the UMD path, since resolution here is CommonJS, so swap the one
			// directory segment to reach the ES module build.
			const require = createRequire(import.meta.url);
			const from = dirname(require.resolve('@ffmpeg/core')).replace(
				`${sep}umd`,
				`${sep}esm`
			);
			const to = resolve('static/ffmpeg');
			mkdirSync(to, { recursive: true });
			for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
				copyFileSync(`${from}/${file}`, `${to}/${file}`);
			}
		}
	};
}

export default defineConfig({
	plugins: [
		ffmpegCore(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	optimizeDeps: {
		// WASM codecs resolve their .wasm files via import.meta.url — esbuild
		// pre-bundling breaks those URLs, so keep them out of the optimizer.
		exclude: ['@jsquash/avif', '@jsquash/webp', 'libheif-js']
	}
});
