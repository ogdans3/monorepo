import { describe, expect, it } from 'vitest';
import { anchorPoint, ANCHORS } from './watermark';

describe('anchorPoint', () => {
	it('places the nine anchors with the margin applied', () => {
		// 1000×500 image, 100×50 mark, margin 3% of 500 = 15
		expect(anchorPoint('tl', 1000, 500, 100, 50)).toEqual({ x: 15, y: 15 });
		expect(anchorPoint('tr', 1000, 500, 100, 50)).toEqual({ x: 885, y: 15 });
		expect(anchorPoint('mc', 1000, 500, 100, 50)).toEqual({ x: 450, y: 225 });
		expect(anchorPoint('bl', 1000, 500, 100, 50)).toEqual({ x: 15, y: 435 });
		expect(anchorPoint('br', 1000, 500, 100, 50)).toEqual({ x: 885, y: 435 });
		expect(anchorPoint('bc', 1000, 500, 100, 50)).toEqual({ x: 450, y: 435 });
	});

	it('covers all nine ids', () => {
		expect(ANCHORS).toHaveLength(9);
		for (const a of ANCHORS) {
			const p = anchorPoint(a.id, 800, 600, 40, 20);
			expect(p.x).toBeGreaterThanOrEqual(0);
			expect(p.y).toBeGreaterThanOrEqual(0);
		}
	});
});
