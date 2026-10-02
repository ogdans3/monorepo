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
		es.onopen = () => on.link?.('open');
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
			if (es.readyState !== EventSource.CLOSED) {
				on.link?.('lost');
				return;
			}
			// The browser stops trying on an answer that is not a stream: a
			// presentation that is gone, or a server on its way back up.
			const res = await fetch(`/api/live/${encodeURIComponent(code)}`).catch(() => null);
			if (stopped) return;
			if (res?.status === 404) {
				on.link?.('missing');
				return;
			}
			on.link?.('lost');
			retry = setTimeout(open, 2000);
		};
	};

	open();
	return () => {
		stopped = true;
		clearTimeout(retry);
		clearInterval(watch);
		document.removeEventListener('visibilitychange', woke);
		source?.close();
	};
}
