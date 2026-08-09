import { describe, expect, it } from 'vitest';
import { tileRects } from './split';

describe('tileRects', () => {
	it('cuts even tiles and gives the remainder to the last row and column', () => {
		const tiles = tileRects(65, 33, 2, 2);
		expect(tiles).toHaveLength(4);
		expect(tiles[0]).toEqual({ row: 0, col: 0, x: 0, y: 0, w: 32, h: 16 });
		expect(tiles[1]).toEqual({ row: 0, col: 1, x: 32, y: 0, w: 33, h: 16 });
		expect(tiles[3]).toEqual({ row: 1, col: 1, x: 32, y: 16, w: 33, h: 17 });
	});

	it('covers every pixel exactly once', () => {
		const tiles = tileRects(100, 70, 3, 4);
		const area = tiles.reduce((sum, t) => sum + t.w * t.h, 0);
		expect(area).toBe(100 * 70);
	});

	it('clamps silly inputs', () => {
		expect(tileRects(10, 10, 0, 999)).toHaveLength(24);
		expect(tileRects(10, 10, 1, 1)).toEqual([{ row: 0, col: 0, x: 0, y: 0, w: 10, h: 10 }]);
	});
});
