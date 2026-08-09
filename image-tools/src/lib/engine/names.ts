/** "IMG_1234.HEIC" + ".jpg" → "IMG_1234.jpg" — the base name survives. */
export function outputFileName(inputName: string, ext: string): string {
	const base = inputName.replace(/\.[^./\\]+$/, '');
	return (base || inputName) + ext;
}

/** "IMG_1.HEIC" + "-cropped" + ".png" → "IMG_1-cropped.png" — for the editing tools. */
export function editedFileName(inputName: string, suffix: string, ext: string): string {
	const base = inputName.replace(/\.[^./\\]+$/, '');
	return (base || inputName) + suffix + ext;
}

const UNITS = ['B', 'KB', 'MB', 'GB'];

export function formatBytes(n: number): string {
	let value = n;
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit++;
	}
	const rounded = unit === 0 ? value : value < 10 ? value.toFixed(1) : Math.round(value);
	return `${rounded} ${UNITS[unit]}`;
}
