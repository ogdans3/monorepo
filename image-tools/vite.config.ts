import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
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
 *
 * It lands under its own version number, which is what lets it be cached for a
 * year and never asked about again. Unversioned, the bytes are identical from
 * one deploy to the next but the file is freshly copied, so its ETag changes
 * and every visitor downloads 32MB again for nothing.
 */
// Resolve through the package's own exports map rather than its package.json,
// which it deliberately does not expose. That gives the UMD path, since
// resolution here is CommonJS, so swap the one directory segment to reach the
// ES module build. The version comes off the package root, two levels up.
const require = createRequire(import.meta.url);
const coreUmdDir = dirname(require.resolve('@ffmpeg/core'));
const coreEsmDir = coreUmdDir.replace(`${sep}umd`, `${sep}esm`);
const coreVersion: string = JSON.parse(
	readFileSync(resolve(coreUmdDir, '..', '..', 'package.json'), 'utf8')
).version;

function ffmpegCore(): Plugin {
	return {
		name: 'copy-ffmpeg-core',
		buildStart() {
			const to = resolve('static/ffmpeg', coreVersion);
			mkdirSync(to, { recursive: true });
			for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
				copyFileSync(`${coreEsmDir}/${file}`, `${to}/${file}`);
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
	// The loader builds its URLs from this, so the path and the files that are
	// actually there can never drift apart.
	define: {
		__FFMPEG_CORE_VERSION__: JSON.stringify(coreVersion)
	},
	optimizeDeps: {
		// WASM codecs resolve their .wasm files via import.meta.url — esbuild
		// pre-bundling breaks those URLs, so keep them out of the optimizer.
		exclude: ['@jsquash/avif', '@jsquash/webp', 'libheif-js']
	}
});
