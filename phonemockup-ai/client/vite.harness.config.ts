import {defineConfig} from "vite";
import {fileURLToPath} from "node:url";

/**
 * Builds the headless render harness into a single self-contained IIFE that
 * the MCP server injects into headless Chromium. Deliberately separate from
 * the SvelteKit build: no SvelteKit, no Tailwind, no app shell — just the
 * scene code, three.js and the model/animation data.
 */
export default defineConfig({
    resolve: {
        alias: {
            $lib: fileURLToPath(new URL("./src/lib", import.meta.url))
        }
    },
    build: {
        outDir: fileURLToPath(new URL("../mcp/harness", import.meta.url)),
        emptyOutDir: true,
        target: "chrome120",
        lib: {
            entry: fileURLToPath(new URL("./src/lib/render/headless-harness.ts", import.meta.url)),
            name: "mockupHarness",
            formats: ["iife"],
            fileName: () => "harness.js"
        }
    }
});
