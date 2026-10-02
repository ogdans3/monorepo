// The one way the app talks to the server. Errors arrive with a message in
// Norwegian, written to be shown as it is.

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string
	) {
		super(message);
	}
}

/** Signed out mid-session: the admin pages listen and show the sign-in. */
export const signedOut = new EventTarget();

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
	let res: Response;
	try {
		res = await fetch(path, {
			method,
			headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
			credentials: 'same-origin'
		});
	} catch {
		throw new ApiError(0, 'offline', 'Får ikke kontakt med serveren. Sjekk nettet og prøv igjen.');
	}
	if (res.status === 204) return undefined as T;
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		if (res.status === 401 && path.startsWith('/api/admin/') && path !== '/api/admin/login') {
			signedOut.dispatchEvent(new Event('signedout'));
		}
		throw new ApiError(res.status, data.error ?? 'error', data.message ?? 'Noe gikk galt.');
	}
	return data as T;
}

/**
 * Uploads a file to a presentation, reporting progress from 0 to 1. Fetch
 * cannot tell how much of a body has gone, and a video can take a while.
 */
export function upload<T>(path: string, file: File, progress?: (done: number) => void): Promise<T> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', path);
		xhr.responseType = 'json';
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) progress?.(e.loaded / e.total);
		};
		xhr.onload = () => {
			const data = xhr.response ?? {};
			if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
			else {
				if (xhr.status === 401) signedOut.dispatchEvent(new Event('signedout'));
				reject(new ApiError(xhr.status, data.error ?? 'error', data.message ?? 'Opplastingen feilet.'));
			}
		};
		xhr.onerror = () => reject(new ApiError(0, 'offline', 'Opplastingen ble brutt. Prøv igjen.'));
		const form = new FormData();
		form.append('file', file);
		xhr.send(form);
	});
}

export function message(err: unknown): string {
	return err instanceof Error ? err.message : 'Noe gikk galt.';
}
