// The text colour a slide gets when the presenter has not chosen one: light
// on a dark ground, dark on a light one.

export const LIGHT = '#F2F4F6';
export const DARK = '#111418';

function luminance(hex: string): number {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!m) return 0;
	const n = parseInt(m[1], 16);
	const channel = (v: number) => {
		const c = v / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function textOn(background: string): string {
	// The crossing point where dark and light text have the same contrast.
	return luminance(background) > 0.179 ? DARK : LIGHT;
}

/** Backgrounds to start from: the room's ink, paper, and a few deep grounds. */
export const BACKGROUNDS = ['#111418', '#F4F5F6', '#FFFFFF', '#1D2B3A', '#24352B', '#3A1F24', '#E9E2D3'];

/** Text colours to start from, besides the automatic one. */
export const INKS = ['#F2F4F6', '#111418', '#8FB8E8', '#9BD3AE', '#E88F8F'];
