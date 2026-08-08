/** Trigger a browser download for a generated blob. */
export function downloadBlob(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.appendChild(a); // Firefox wants it in the DOM
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
