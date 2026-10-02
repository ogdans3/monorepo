import qrcode from 'qrcode-generator';
import { expect, it } from 'vitest';
import { ballotUrl, qrPath, shortHost } from './qr';

it('draws every dark module and nothing else', () => {
	const text = 'https://podium.example.no/stem/K7M2Q';
	const { size, path } = qrPath(text);
	const qr = qrcode(0, 'M');
	qr.addData(text);
	qr.make();
	expect(size).toBe(qr.getModuleCount());
	let dark = 0;
	for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (qr.isDark(r, c)) dark++;
	const drawn = [...path.matchAll(/h(\d+)/g)].reduce((n, m) => n + Number(m[1]), 0);
	expect(drawn).toBe(dark);
});

it('makes the ballot address and the one to read out', () => {
	expect(ballotUrl('https://podium.example.no/', 'K7M2Q')).toBe('https://podium.example.no/stem/K7M2Q');
	expect(shortHost('https://podium.example.no')).toBe('podium.example.no');
	expect(shortHost('http://192.168.1.20:4120')).toBe('192.168.1.20:4120');
});
