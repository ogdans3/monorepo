/**
 * Shared PDF plumbing. pdfjs draws page previews, pdf-lib rewrites documents.
 * Both are dynamic imports: together they are well over a megabyte, and only
 * the document tools should ever pay for them.
 */

export interface PdfPage {
	/** 1-based page number in the original document. */
	n: number;
	url: string;
	w: number;
	h: number;
}

export interface LoadedPdf {
	/** A pristine copy of the file, safe to hand to pdf-lib. */
	bytes: Uint8Array;
	name: string;
	pageCount: number;
	pages: PdfPage[];
}

/** %PDF */
export function looksLikePdf(head: Uint8Array): boolean {
	return head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
}

export async function loadPdfjs() {
	const pdfjs = await import('pdfjs-dist');
	pdfjs.GlobalWorkerOptions.workerSrc = new URL(
		'pdfjs-dist/build/pdf.worker.min.mjs',
		import.meta.url
	).toString();
	return pdfjs;
}

/** Read a file, check it is a PDF, and render a thumbnail per page. */
export async function readPdf(file: File, scale = 0.45): Promise<LoadedPdf> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!looksLikePdf(bytes)) throw new Error(`${file.name} does not look like a PDF`);

	const pdfjs = await loadPdfjs();
	// pdfjs may take ownership of the buffer it is given, so it gets a copy and
	// the original stays clean for pdf-lib.
	const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
	const pages: PdfPage[] = [];
	for (let n = 1; n <= doc.numPages; n++) {
		const page = await doc.getPage(n);
		const viewport = page.getViewport({ scale });
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(viewport.width));
		canvas.height = Math.max(1, Math.round(viewport.height));
		await page.render({ canvas, viewport }).promise;
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', 0.7)
		);
		pages.push({
			n,
			url: blob ? URL.createObjectURL(blob) : '',
			w: canvas.width,
			h: canvas.height
		});
	}
	return { bytes, name: file.name, pageCount: doc.numPages, pages };
}

export function releasePdf(pdf: LoadedPdf | null) {
	for (const page of pdf?.pages ?? []) URL.revokeObjectURL(page.url);
}

export async function loadPdfLib() {
	return import('pdf-lib');
}

/** A new document holding the given 1-based pages of `bytes`, in that order. */
export async function pdfWithPages(bytes: Uint8Array, pageNumbers: number[]): Promise<Uint8Array> {
	const { PDFDocument } = await loadPdfLib();
	const source = await PDFDocument.load(bytes.slice());
	const out = await PDFDocument.create();
	const copied = await out.copyPages(
		source,
		pageNumbers.map((n) => n - 1)
	);
	for (const page of copied) out.addPage(page);
	return out.save();
}

export function pdfBlob(bytes: Uint8Array): Blob {
	return new Blob([bytes as unknown as ArrayBuffer], { type: 'application/pdf' });
}

/** "report.pdf" + "-merged" → "report-merged.pdf" */
export function pdfName(base: string, suffix: string): string {
	return base.replace(/\.pdf$/i, '') + suffix + '.pdf';
}

/**
 * Parse a page range like "1-3, 5, 8-" into 1-based page numbers, clamped to
 * the document and sorted with duplicates removed. Empty input means all pages.
 */
export function parsePageRange(input: string, pageCount: number): number[] {
	const trimmed = input.trim();
	if (!trimmed) return Array.from({ length: pageCount }, (_, i) => i + 1);
	const picked = new Set<number>();
	for (const part of trimmed.split(',')) {
		const chunk = part.trim();
		if (!chunk) continue;
		const dash = chunk.indexOf('-');
		if (dash === -1) {
			const n = Number(chunk);
			if (Number.isInteger(n) && n >= 1 && n <= pageCount) picked.add(n);
			continue;
		}
		const fromRaw = chunk.slice(0, dash).trim();
		const toRaw = chunk.slice(dash + 1).trim();
		const from = fromRaw ? Number(fromRaw) : 1;
		const to = toRaw ? Number(toRaw) : pageCount;
		if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
		for (let n = Math.max(1, Math.floor(from)); n <= Math.min(pageCount, Math.floor(to)); n++) {
			picked.add(n);
		}
	}
	return [...picked].sort((a, b) => a - b);
}
