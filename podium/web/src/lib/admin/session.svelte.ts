import { api, signedOut } from '$lib/api';

/** Whether this browser is signed in to the admin, once it is known. */
class Session {
	admin = $state<boolean | null>(null);
	/** The biggest upload the server takes, in bytes; 0 while unknown. */
	maxUpload = $state(0);

	constructor() {
		signedOut.addEventListener('signedout', () => (this.admin = false));
	}

	async check() {
		try {
			const me = await api<{ admin: boolean; maxUploadBytes?: number }>('GET', '/api/admin/me');
			this.maxUpload = me.maxUploadBytes ?? 0;
			this.admin = me.admin;
		} catch {
			this.admin = false;
		}
	}

	async signIn(password: string) {
		await api('POST', '/api/admin/login', { password });
		await this.check();
	}

	async signOut() {
		await api('POST', '/api/admin/logout').catch(() => {});
		this.admin = false;
	}
}

export const session = new Session();
