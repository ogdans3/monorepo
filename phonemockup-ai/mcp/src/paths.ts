import {existsSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Package root, whether running from `dist/` or from `src/` via a loader. */
export const packageRoot = resolve(here, "..");

export const harnessBundle = resolve(packageRoot, "harness/harness.js");

/**
 * Where the phone `.glb` files live.
 *
 * They total ~85 MB, so they are not copied into this package; by default we
 * read them straight out of the client's static directory in this repo. Set
 * `PHONEMOCKUP_STATIC_DIR` to point somewhere else.
 */
export function resolveStaticDir(): string {
    const fromEnv = process.env.PHONEMOCKUP_STATIC_DIR;
    if (fromEnv) {
        if (!existsSync(fromEnv)) {
            throw new Error(`PHONEMOCKUP_STATIC_DIR does not exist: ${fromEnv}`);
        }
        return resolve(fromEnv);
    }

    const fromRepo = resolve(packageRoot, "../client/static");
    if (existsSync(fromRepo)) return fromRepo;

    throw new Error(
        "Could not find the phone model assets. Expected them at " +
        `${fromRepo}. Set PHONEMOCKUP_STATIC_DIR to the directory holding the .glb files.`
    );
}
