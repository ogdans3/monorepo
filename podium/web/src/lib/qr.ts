import qrcode from 'qrcode-generator';

/**
 * A QR code as one SVG path, a module to a unit, with each row's runs of
 * dark modules drawn as one rectangle. Medium error correction: a projector
 * is a clean surface, and a smaller code is a bigger module.
 */
export function qrPath(text: string): { size: number; path: string } {
	const qr = qrcode(0, 'M');
	qr.addData(text);
	qr.make();
	const size = qr.getModuleCount();
	let path = '';
	for (let row = 0; row < size; row++) {
		for (let col = 0; col < size; ) {
			if (!qr.isDark(row, col)) {
				col++;
				continue;
			}
			let run = 1;
			while (col + run < size && qr.isDark(row, col + run)) run++;
			path += `M${col} ${row}h${run}v1h-${run}z`;
			col += run;
		}
	}
	return { size, path };
}

/** Where a phone votes on a presentation, for the code and for typing. */
export function ballotUrl(origin: string, code: string): string {
	return `${origin.replace(/\/$/, '')}/stem/${code}`;
}

/** The address to read out, without the scheme: «podium.example.no». */
export function shortHost(origin: string): string {
	return origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
