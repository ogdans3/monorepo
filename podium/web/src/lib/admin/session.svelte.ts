import { api, signedOut } from '$lib/api';

/** Whether this browser is signed in to the admin, once it is known. */
class Session {
	admin = $state<boolean | null>(null);

	constructor() {
		signedOut.addEventListener('signedout', () => (this.admin = false));
	}

	async check() {
		try {
			this.admin = (await api<{ admin: boolean }>('GET', '/api/admin/me')).admin;
		} catch {
			this.admin = false;
		}
	}

	async signIn(password: string) {
		await api('POST', '/api/admin/login', { password });
		this.admin = true;
	}

	async signOut() {
		await api('POST', '/api/admin/logout').catch(() => {});
		this.admin = false;
	}
}

export const session = new Session();
