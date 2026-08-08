import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { zipBlobs } from './zip';

describe('zipBlobs', () => {
	it('bundles files and deduplicates clashing names', async () => {
		const blob = zipBlobs([
			{ name: 'photo.jpg', data: new Uint8Array([1]) },
			{ name: 'photo.jpg', data: new Uint8Array([2]) },
			{ name: 'photo.jpg', data: new Uint8Array([3]) },
			{ name: 'other.jpg', data: new Uint8Array([4]) }
		]);
		const unzipped = unzipSync(new Uint8Array(await blob.arrayBuffer()));
		expect(Object.keys(unzipped).sort()).toEqual([
			'other.jpg',
			'photo (1).jpg',
			'photo (2).jpg',
			'photo.jpg'
		]);
		expect(unzipped['photo.jpg']).toEqual(new Uint8Array([1]));
		expect(unzipped['photo (2).jpg']).toEqual(new Uint8Array([3]));
	});
});
