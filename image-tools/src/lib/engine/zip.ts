import { zipSync } from 'fflate';

/** Bundle converted files into one zip, deduplicating clashing names. */
export function zipBlobs(entries: { name: string; data: Uint8Array }[]): Blob {
	const files = new Map<string, Uint8Array>();
	for (const entry of entries) {
		let name = entry.name;
		for (let i = 1; files.has(name); i++) {
			const dot = entry.name.lastIndexOf('.');
			name =
				dot > 0
					? `${entry.name.slice(0, dot)} (${i})${entry.name.slice(dot)}`
					: `${entry.name} (${i})`;
		}
		files.set(name, entry.data);
	}
	// level 0: the images inside are already compressed.
	const zipped = zipSync(Object.fromEntries(files), { level: 0 });
	return new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}
