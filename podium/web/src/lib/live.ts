import type { LiveState, VoteEvent } from './types';

export type Link = 'connecting' | 'open' | 'lost' | 'missing';

interface Handlers {
	state?: (s: LiveState) => void;
	vote?: (v: VoteEvent) => void;
	room?: (r: { phones: number }) => void;
	link?: (l: Link) => void;
}

/** The server says something every 20 seconds; this long without a word is a dead line. */
export const SILENT_MS = 45_000;

/**
 * How long a stream may be away before it is said to be lost. A deployment's
 * proxy ends every stream after two minutes and the browser is back within a
 * second, which is nothing to tell a room about.
 */
export const LOST_MS = 4_000;

/**
 * Follows a presentation as it happens, over server-sent events. A dropped
 * connection is picked up again by the browser, and when the browser gives
 * up, by this: unless the presentation is gone, which is said once, as
 * «missing». A connection can also die without a word, on a sleeping phone
 * or a network that changed under it, so a stream that has been silent for
 * [SILENT_MS] is closed and opened again; the first thing a new one says is
 * where things stand. A phone's ballot follows with [ballot], and hears no
 * votes.
 */
export function follow(code: string, on: Handlers, ballot = false): () => void {
	let source: EventSource | null = null;
	let retry: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	let heard = Date.now();
	let lostTimer: ReturnType<typeof setTimeout> | undefined;
	const away = () => {
		clearTimeout(lostTimer);
		lostTimer = setTimeout(() => !stopped && on.link?.('lost'), LOST_MS);
	};

	const restart = () => {
		source?.close();
		clearTimeout(retry);
		open();
	};
	const stale = () => Date.now() - heard > SILENT_MS;
	const watch = setInterval(() => {
		if (!stopped && stale()) restart();
	}, 10_000);
	const woke = () => {
		if (document.visibilityState === 'visible' && !stopped && stale()) restart();
	};
	document.addEventListener('visibilitychange', woke);

	const parse = <T>(e: Event): T | null => {
		try {
			return JSON.parse((e as MessageEvent).data) as T;
		} catch {
			return null;
		}
	};

	const open = () => {
		if (stopped) return;
		on.link?.('connecting');
		heard = Date.now();
		const es = new EventSource(`/api/live/${encodeURIComponent(code)}/events${ballot ? '?ballot' : ''}`);
		source = es;
		es.onopen = () => {
			clearTimeout(lostTimer);
			on.link?.('open');
		};
		es.addEventListener('state', (e) => {
			heard = Date.now();
			const s = parse<LiveState>(e);
			if (s) on.state?.(s);
		});
		es.addEventListener('vote', (e) => {
			heard = Date.now();
			const v = parse<VoteEvent>(e);
			if (v) on.vote?.(v);
		});
		es.addEventListener('room', (e) => {
			heard = Date.now();
			const r = parse<{ phones: number }>(e);
			if (r) on.room?.(r);
		});
		es.addEventListener('ping', () => (heard = Date.now()));
		es.onerror = async () => {
			if (stopped) return;
			// The browser is already on its way back: say so only if it takes long.
			if (es.readyState !== EventSource.CLOSED) {
				away();
				return;
			}
			// The browser stops trying on an answer that is not a stream: a
			// presentation that is gone, or a server on its way back up.
			const res = await fetch(`/api/live/${encodeURIComponent(code)}`).catch(() => null);
			if (stopped) return;
			if (res?.status === 404) {
				clearTimeout(lostTimer);
				on.link?.('missing');
				return;
			}
			away();
			retry = setTimeout(open, 1500);
		};
	};

	open();
	return () => {
		stopped = true;
		clearTimeout(retry);
		clearTimeout(lostTimer);
		clearInterval(watch);
		document.removeEventListener('visibilitychange', woke);
		source?.close();
	};
}
