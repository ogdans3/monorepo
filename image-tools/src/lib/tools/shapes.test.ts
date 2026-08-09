import { describe, expect, it } from 'vitest';
import { dragToShape } from './shapes';

describe('dragToShape', () => {
	it('normalises drags in any direction', () => {
		expect(dragToShape('rect', 50, 40, 10, 20, 100, 100)).toEqual({
			kind: 'rect',
			x: 10,
			y: 20,
			w: 40,
			h: 20
		});
	});

	it('clamps to the image bounds', () => {
		const s = dragToShape('ellipse', -20, -5, 60, 200, 100, 100);
		expect(s).toEqual({ kind: 'ellipse', x: 0, y: 0, w: 60, h: 100 });
	});

	it('returns null while the drag is too small', () => {
		expect(dragToShape('rect', 10, 10, 12, 40, 100, 100)).toBeNull();
		expect(dragToShape('rect', 10, 10, 40, 12, 100, 100)).toBeNull();
		expect(dragToShape('rect', 10, 10, 15, 15, 100, 100, 4)).toEqual({
			kind: 'rect',
			x: 10,
			y: 10,
			w: 5,
			h: 5
		});
	});
});
