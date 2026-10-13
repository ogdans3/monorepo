// Testpublikum's page. Signing in is Podium's password. Then it starts a room
// of phones on a presentation and shows what the room is doing, asking the
// server once a second and changing only what has changed, so a button being
// pressed or a field being typed in is never redrawn from under the hand.

'use strict';

const app = document.getElementById('app');

class ApiError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

async function api(method, path, body) {
	const init = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
	if (body !== undefined) {
		init.headers['Content-Type'] = 'application/json';
		init.body = JSON.stringify(body);
	}
	let res;
	try {
		res = await fetch(path, init);
	} catch {
		throw new ApiError(0, 'offline', 'Får ikke kontakt med Testpublikum. Sjekk nettet.');
	}
	if (res.status === 204) return null;
	let data = null;
	try {
		data = await res.json();
	} catch {
		/* not JSON: said below */
	}
	if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'Noe gikk galt. Prøv igjen.');
	return data;
}

/** An element, with its attributes, listeners and children. */
function h(tag, props = {}, ...children) {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(props)) {
		if (v === null || v === undefined || v === false) continue;
		if (k === 'class') el.className = v;
		else if (k === 'text') el.textContent = v;
		else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
		else el.setAttribute(k, v === true ? '' : String(v));
	}
	for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
	return el;
}

/** Sets text only when it differs, so nothing is redrawn that has not changed. */
function put(el, text) {
	const t = String(text);
	if (el.textContent !== t) el.textContent = t;
}

function svg(markup) {
	const t = document.createElement('template');
	t.innerHTML = markup.trim();
	return t.content.firstChild;
}

function wordmark(href) {
	return h(
		href ? 'a' : 'span',
		{ class: 'wordmark', href },
		svg(
			'<svg viewBox="0 0 20 18" width="20" height="18" aria-hidden="true"><rect x="1" y="8" width="4" height="8" fill="currentColor"/><rect x="8" y="2" width="4" height="14" fill="currentColor"/><rect x="15" y="5" width="4" height="11" fill="currentColor"/><rect x="0" y="16.6" width="20" height="1.4" fill="currentColor"/></svg>'
		),
		h('span', { text: 'Podium' })
	);
}

/** A link to Podium, which opens beside this page and says so. */
function away(href, text) {
	return h(
		'a',
		{ class: 'btn quiet small away', href, target: '_blank', rel: 'noopener' },
		text,
		svg(
			'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>'
		),
		h('span', { class: 'visually-hidden', text: ' (åpnes i en ny fane)' })
	);
}

/** The mark of the answer at [i]: A, B … Z, AA …, or 1, 2, 3, as Podium marks it. */
function mark(i, marks) {
	if (marks === 'numbers') return String(i + 1);
	let n = i;
	let out = '';
	do {
		out = String.fromCharCode(65 + (n % 26)) + out;
		n = Math.floor(n / 26) - 1;
	} while (n >= 0);
	return out;
}

/** Text that reads on an answer's colour: white on Podium's own eight, dark on a light one. */
function inkOn(hex) {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
	if (!m) return '#FFFFFF';
	const lin = (v) => {
		const c = v / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const n = parseInt(m[1], 16);
	const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
	return l > 0.179 ? '#111418' : '#FFFFFF';
}

const clock = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const hourMinute = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' });

function phones(n) {
	return n === 1 ? '1 telefon' : `${n} telefoner`;
}

const state = {
	me: null,
	presentations: [],
	chosen: '',
	running: new Set(),
	busy: false,
};

let pollTimer = 0;
let listTimer = 0;

async function boot() {
	try {
		state.me = await api('GET', '/api/me');
	} catch (err) {
		app.replaceChildren(h('main', { class: 'sign-in' }, h('p', { class: 'error', role: 'alert', text: err.message })));
		app.removeAttribute('aria-busy');
		return;
	}
	app.removeAttribute('aria-busy');
	if (state.me.signedIn) showDesk();
	else showSignIn();
}

function signedOut() {
	clearTimeout(pollTimer);
	clearTimeout(listTimer);
	rooms.clear();
	showSignIn('Du er logget ut. Logg inn igjen med Podium-passordet.');
}

/* Signing in. */

function showSignIn(note = '') {
	document.title = 'Logg inn · Testpublikum';
	const password = h('input', {
		class: 'input',
		type: 'password',
		name: 'password',
		autocomplete: 'current-password',
		required: true,
		'aria-describedby': 'sign-in-about',
	});
	const error = h('p', { class: 'error', id: 'sign-in-error', role: 'alert', hidden: !note, text: note });
	const button = h('button', { class: 'btn primary', type: 'submit', text: 'Logg inn' });
	const form = h(
		'form',
		{
			onsubmit: async (e) => {
				e.preventDefault();
				if (state.busy) return;
				if (!password.value) {
					error.hidden = false;
					put(error, 'Skriv inn passordet.');
					password.focus();
					return;
				}
				state.busy = true;
				button.setAttribute('aria-busy', 'true');
				put(button, 'Logger inn …');
				try {
					await api('POST', '/api/login', { password: password.value });
					state.me = await api('GET', '/api/me');
					showDesk();
				} catch (err) {
					error.hidden = false;
					put(error, err.message);
					password.value = '';
					password.setAttribute('aria-invalid', 'true');
					password.setAttribute('aria-describedby', 'sign-in-about sign-in-error');
					password.focus();
				} finally {
					state.busy = false;
					button.removeAttribute('aria-busy');
					put(button, 'Logg inn');
				}
			},
		},
		wordmark(),
		h('h1', { text: 'Testpublikum' }),
		h('p', { class: 'quiet', id: 'sign-in-about', text: 'Logg inn med passordet til Podium.' }),
		h('label', { class: 'field' }, h('span', { text: 'Passord' }), password),
		button,
		error
	);
	app.replaceChildren(h('main', { class: 'sign-in' }, form));
	password.focus();
}

/* The desk. */

let roomsHost;
let trouble;
let choicesHost;
let startButton;
let startError;
let replaceHint;

function showDesk() {
	document.title = 'Testpublikum · Podium';
	const podium = state.me.podium;

	trouble = h('p', { class: 'trouble', role: 'status', hidden: true });
	roomsHost = h('div', { class: 'rooms', hidden: true });

	app.replaceChildren(
		h(
			'header',
			{ class: 'top' },
			wordmark(`${podium}/admin`),
			h(
				'nav',
				{ 'aria-label': 'Konto' },
				h('button', {
					class: 'btn quiet small',
					type: 'button',
					text: 'Logg ut',
					onclick: async () => {
						try {
							await api('POST', '/api/logout');
						} finally {
							signedOut();
						}
					},
				})
			)
		),
		h(
			'main',
			{ class: 'page' },
			h(
				'div',
				{ class: 'intro' },
				h('h1', { text: 'Testpublikum' }),
				h('p', {
					text: 'Telefoner som stemmer i presentasjonen mens du øver: litt tilfeldig, noen sekunder etter hverandre og ikke alle sammen, slik en sal gjør. De kobler seg på slik en telefon gjør etter å ha skannet koden.',
				})
			),
			trouble,
			roomsHost,
			newRunForm()
		)
	);
	refreshPresentations();
	poll();
}

function newRunForm() {
	const me = state.me;
	choicesHost = h('div', { class: 'choices', role: 'radiogroup', 'aria-labelledby': 'presentation-label' });

	const count = h('input', {
		class: 'input',
		type: 'number',
		name: 'phones',
		min: 1,
		max: me.maxPhones,
		step: 1,
		value: 30,
		inputmode: 'numeric',
		'aria-labelledby': 'phones-label',
	});
	const presets = [10, 30, 100, me.maxPhones].map((n) =>
		h('button', {
			type: 'button',
			text: String(n),
			'aria-pressed': n === 30 ? 'true' : 'false',
			'aria-label': phones(n),
			onclick: () => {
				count.value = String(n);
				markPresets();
			},
		})
	);
	const markPresets = () => {
		for (const b of presets) b.setAttribute('aria-pressed', String(b.textContent === count.value));
	};
	count.addEventListener('input', markPresets);

	const about = h('p', { class: 'hint', id: 'pace-about' });
	const paceInputs = me.paces.map((p) =>
		h(
			'label',
			{},
			h('input', {
				type: 'radio',
				name: 'pace',
				value: p.name,
				checked: p.name === 'vanlig',
				'aria-describedby': 'pace-about',
				onchange: () => put(about, p.about),
			}),
			h('span', { text: p.label })
		)
	);
	put(about, me.paces.find((p) => p.name === 'vanlig')?.about ?? '');

	startButton = h('button', { class: 'btn primary', type: 'submit', text: 'Start testpublikum' });
	startError = h('p', { class: 'error', role: 'alert', hidden: true });
	replaceHint = h('p', {
		class: 'hint',
		hidden: true,
		text: 'Det går allerede en test på denne presentasjonen. Den nye tar over for den.',
	});

	const form = h(
		'form',
		{
			novalidate: true,
			onsubmit: async (e) => {
				e.preventDefault();
				if (state.busy) return;
				const n = Number(count.value);
				const pace = form.elements.pace.value;
				startError.hidden = true;
				if (!state.chosen) return failStart('Velg en presentasjon.');
				if (!Number.isInteger(n) || n < 1 || n > me.maxPhones) {
					count.focus();
					return failStart(`Velg mellom 1 og ${me.maxPhones} telefoner.`);
				}
				state.busy = true;
				startButton.setAttribute('aria-busy', 'true');
				put(startButton, 'Starter …');
				try {
					const v = await api('POST', '/api/runs', { code: state.chosen, phones: n, pace });
					renderRooms([v, ...currentViews().filter((x) => x.code !== v.code)]);
					rooms.get(v.code)?.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
					poll();
				} catch (err) {
					if (err.status === 401) return signedOut();
					failStart(err.message);
				} finally {
					state.busy = false;
					startButton.removeAttribute('aria-busy');
					put(startButton, 'Start testpublikum');
				}
			},
		},
		h(
			'fieldset',
			{ class: 'field' },
			h('legend', { id: 'presentation-label', text: 'Presentasjon' }),
			choicesHost
		),
		h(
			'fieldset',
			{ class: 'field' },
			h('legend', { id: 'phones-label', text: 'Telefoner' }),
			h('div', { class: 'count-row' }, h('div', { class: 'segments', role: 'group', 'aria-label': 'Vanlige antall' }, presets), count)
		),
		h(
			'fieldset',
			{ class: 'field' },
			h('legend', { text: 'Tempo' }),
			h('div', { class: 'segments' }, paceInputs),
			about
		),
		h('p', {
			class: 'note',
			text: 'Testpublikummet stemmer på ordentlig, så stemmene blir liggende i presentasjonen. Nullstill dem før foredraget: Podium spør om det når du trykker Start. En test stopper av seg selv etter tre timer.',
		}),
		h('div', { class: 'go' }, startButton, startError),
		replaceHint
	);
	return h('section', { class: 'new', 'aria-labelledby': 'new-title' }, h('h2', { id: 'new-title', text: 'Ny test' }), form);
}

function failStart(message) {
	startError.hidden = false;
	put(startError, message);
}

function chooseHint() {
	if (replaceHint) replaceHint.hidden = !state.running.has(state.chosen);
}

/* The presentations to choose from, kept in place as they are refreshed. */

const choiceRows = new Map();

async function refreshPresentations() {
	clearTimeout(listTimer);
	try {
		const { presentations } = await api('GET', '/api/presentations');
		state.presentations = presentations;
		renderChoices();
	} catch (err) {
		if (err.status === 401) return signedOut();
		showTrouble(err.message);
	}
	// Often enough to see a presentation start or stop in Podium.
	listTimer = setTimeout(refreshPresentations, 15000);
}

function renderChoices() {
	const list = state.presentations;
	if (!state.chosen || !list.some((p) => p.code === state.chosen)) state.chosen = list[0]?.code ?? '';
	if (list.length === 0) {
		choiceRows.clear();
		choicesHost.replaceChildren(h('p', { class: 'none', text: 'Det finnes ingen presentasjoner i Podium ennå.' }));
		return;
	}
	const seen = new Set();
	list.forEach((p, i) => {
		seen.add(p.code);
		let row = choiceRows.get(p.code);
		if (!row) {
			const input = h('input', {
				type: 'radio',
				name: 'presentation',
				value: p.code,
				onchange: () => {
					state.chosen = p.code;
					chooseHint();
				},
			});
			row = {
				input,
				title: h('span', { class: 't' }),
				code: h('span', { class: 'code figure', text: p.code }),
				slides: h('span', { class: 'n' }),
				chip: h('span', { class: 'chip' }),
			};
			row.el = h('label', { class: 'choice' }, input, row.title, row.code, row.slides, row.chip);
			choiceRows.set(p.code, row);
		}
		put(row.title, p.title || 'Uten tittel');
		put(row.slides, p.slides === 1 ? '1 side' : `${p.slides} sider`);
		row.chip.replaceChildren(...(p.live ? [h('span', { class: 'live', text: 'Direkte' })] : []));
		row.input.checked = p.code === state.chosen;
		if (choicesHost.children[i] !== row.el) choicesHost.insertBefore(row.el, choicesHost.children[i] ?? null);
	});
	for (const [code, row] of choiceRows) {
		if (!seen.has(code)) {
			row.el.remove();
			choiceRows.delete(code);
		}
	}
	for (const el of [...choicesHost.children]) if (!el.classList.contains('choice')) el.remove();
	chooseHint();
}

/* The rooms. */

const rooms = new Map();

function currentViews() {
	return [...rooms.values()].map((r) => r.view).filter(Boolean);
}

async function poll() {
	clearTimeout(pollTimer);
	try {
		const { runs } = await api('GET', '/api/runs');
		showTrouble('');
		renderRooms(runs);
	} catch (err) {
		if (err.status === 401) return signedOut();
		showTrouble(err.message);
	}
	pollTimer = setTimeout(poll, document.hidden ? 5000 : 1000);
}

document.addEventListener('visibilitychange', () => {
	if (!document.hidden && roomsHost?.isConnected) poll();
});

function showTrouble(message) {
	if (!trouble) return;
	trouble.hidden = !message;
	put(trouble, message);
}

function renderRooms(views) {
	state.running = new Set(views.filter((v) => !v.stopped).map((v) => v.code));
	const seen = new Set();
	views.forEach((v, i) => {
		seen.add(v.code);
		let room = rooms.get(v.code);
		if (!room) {
			room = new Room(v.code);
			rooms.set(v.code, room);
		}
		room.update(v);
		if (roomsHost.children[i] !== room.el) roomsHost.insertBefore(room.el, roomsHost.children[i] ?? null);
	});
	for (const [code, room] of rooms) {
		if (!seen.has(code)) {
			room.el.remove();
			rooms.delete(code);
		}
	}
	roomsHost.hidden = views.length === 0;
	chooseHint();
}

class Room {
	constructor(code) {
		this.code = code;
		this.view = null;
		this.moved = [];
		const id = `room-${code}`;
		const podium = state.me.podium;

		this.title = h('span', { class: 'title' });
		this.where = h('p', { class: 'where' });
		this.connected = h('span', { class: 'figure big' });
		this.total = h('span', { class: 'figure' });
		this.pace = h('span');
		this.stops = h('span');
		this.fewer = h('button', {
			type: 'button',
			text: '−10',
			'aria-label': '10 færre telefoner',
			onclick: () => this.resize(-10),
		});
		this.more = h('button', {
			type: 'button',
			text: '+10',
			'aria-label': '10 flere telefoner',
			onclick: () => this.resize(10),
		});
		this.stop = h('button', { class: 'btn', type: 'button', text: 'Stopp', onclick: () => this.halt() });
		this.again = h('button', { class: 'btn primary', type: 'button', text: 'Start igjen', onclick: () => this.restart() });
		this.remove = h('button', { class: 'btn quiet', type: 'button', text: 'Fjern', onclick: () => this.dismiss() });
		this.error = h('p', { class: 'error', role: 'alert', hidden: true });

		this.question = h('h3');
		this.answers = h('ol', { class: 'answers' });
		this.tally = h('p', { class: 'tally' });
		this.waiting = h('p', { class: 'waiting' });
		this.screen = h('section', { class: 'screen', 'aria-label': 'Skjermen nå' }, this.question, this.answers, this.tally, this.waiting);
		this.lines = h('ol');

		this.el = h(
			'article',
			{ class: 'room', 'aria-labelledby': id },
			h(
				'header',
				{ class: 'room-head' },
				h('div', { class: 'who' }, h('h2', { id }, this.title, h('span', { class: 'code figure', text: code })), this.where),
				h(
					'div',
					{ class: 'acts' },
					away(`${podium}/vis/${code}`, 'Skjermen'),
					away(`${podium}/stem/${code}`, 'Stemmesiden'),
					this.stop,
					this.again,
					this.remove
				)
			),
			this.error,
			h(
				'dl',
				{ class: 'facts' },
				h(
					'div',
					{},
					h('dt', { text: 'Telefoner' }),
					h(
						'dd',
						{},
						h('span', { class: 'phones' }, this.connected, h('span', { class: 'quiet', text: 'av' }), this.total, h('span', { class: 'quiet', text: 'koblet til' })),
						h('span', { class: 'segments' }, this.fewer, this.more)
					)
				),
				h('div', {}, h('dt', { text: 'Tempo' }), h('dd', {}, this.pace)),
				h('div', {}, h('dt', { text: 'Stopper' }), h('dd', {}, this.stops))
			),
			this.screen,
			h('section', { class: 'log', 'aria-label': 'Hendelser' }, h('h3', { class: 'label', text: 'Hendelser' }), this.lines)
		);
	}

	update(v) {
		const before = this.view;
		this.view = v;
		const stopped = !!v.stopped;
		this.el.classList.toggle('stopped', stopped);
		put(this.title, v.title || 'Uten tittel');

		// Where the presentation is, as the phones see it.
		const where = [];
		if (stopped) where.push(h('span', { text: v.stopped }));
		else if (v.screen?.live) {
			where.push(h('span', { class: 'live', text: 'Direkte' }));
			where.push(h('span', {}, 'side ', h('span', { class: 'figure', text: v.screen.index }), ' av ', h('span', { class: 'figure', text: v.screen.count })));
		} else if (v.screen) where.push(h('span', { text: 'Presentasjonen er ikke startet i Podium.' }));
		else where.push(h('span', { text: 'Telefonene kobler seg på …' }));
		const key = JSON.stringify([v.stopped, v.screen?.live, v.screen?.index, v.screen?.count, !!v.screen]);
		if (this.whereKey !== key) {
			this.whereKey = key;
			this.where.replaceChildren(...where);
		}

		put(this.connected, v.connected);
		put(this.total, v.phones);
		const pace = state.me.paces.find((p) => p.name === v.pace);
		put(this.pace, pace?.label ?? v.pace);
		put(this.stops, stopped ? 'Stoppet' : `Av seg selv kl. ${hourMinute.format(new Date(v.stopsAt))}`);
		this.fewer.disabled = stopped || v.phones <= 1;
		this.more.disabled = stopped || v.phones >= state.me.maxPhones;
		this.stop.hidden = stopped;
		this.again.hidden = !stopped;
		this.remove.hidden = !stopped;

		this.drawScreen(v, before);
		this.drawLog(v);
	}

	drawScreen(v, before) {
		const q = v.screen?.question;
		const stopped = !!v.stopped;
		this.question.hidden = !q;
		this.answers.hidden = !q;
		this.tally.hidden = !q;
		this.waiting.hidden = !!q;
		if (!q) {
			this.moved = [];
			this.answers.replaceChildren();
			put(
				this.waiting,
				stopped
					? 'Telefonene har gått.'
					: v.screen?.live
						? 'Ingen spørsmål på skjermen nå. Telefonene venter på det neste.'
						: 'Telefonene står klare. De stemmer så snart et spørsmål er på skjermen.'
			);
			return;
		}
		put(this.question, q.title || 'Spørsmål uten tittel');

		// One row per answer, kept, so a count can move and be seen to.
		const sameQuestion = before?.screen?.question?.title === q.title && this.answers.children.length === q.options.length;
		if (!sameQuestion) {
			this.moved.forEach((m) => clearTimeout(m?.timer));
			this.moved = [];
			this.answers.replaceChildren(
				...q.options.map(() => {
					const row = h('li', { class: 'answer' });
					row.mark = h('span', { class: 'mark figure', 'aria-hidden': 'true' });
					row.text = h('span', { class: 'text' });
					row.share = h('span', { class: 'share figure' });
					row.count = h('span', { class: 'count figure' });
					row.fill = h('span');
					row.append(row.mark, row.text, row.share, row.count, h('span', { class: 'bar', 'aria-hidden': 'true' }, row.fill));
					return row;
				})
			);
		}
		const total = q.options.reduce((sum, o) => sum + o.votes, 0);
		q.options.forEach((o, i) => {
			const row = this.answers.children[i];
			const m = mark(i, v.marks);
			row.style.setProperty('--answer', o.color || '#56677D');
			row.style.setProperty('--answer-ink', inkOn(o.color));
			put(row.mark, m);
			put(row.text, o.label || `Svar ${m}`);
			row.setAttribute('aria-label', `${m}: ${o.label || `Svar ${m}`}, ${o.votes === 1 ? '1 stemme' : `${o.votes} stemmer`}`);
			const share = total > 0 ? Math.round((o.votes / total) * 100) : 0;
			put(row.share, `${share} %`);
			put(row.count, o.votes);
			row.fill.style.width = `${total > 0 ? (o.votes / total) * 100 : 0}%`;

			// Amber for a count that has just moved, until it has been still a while.
			const was = this.moved[i]?.votes;
			if (sameQuestion && was !== undefined && o.votes > was) {
				row.count.classList.add('moved');
				clearTimeout(this.moved[i].timer);
				this.moved[i].timer = setTimeout(() => row.count.classList.remove('moved'), 1400);
			}
			this.moved[i] = { votes: o.votes, timer: this.moved[i]?.timer };
		});

		const parts = [
			[q.voted, 'har svart'],
			[q.waiting, 'svarer om litt'],
			[q.passed, 'lar være'],
		];
		const key = JSON.stringify(parts);
		if (this.tallyKey !== key) {
			this.tallyKey = key;
			this.tally.replaceChildren(
				...parts.map(([n, text]) => h('span', {}, h('span', { class: 'figure', text: n }), ` ${text}`))
			);
		}
	}

	drawLog(v) {
		const key = v.log.length ? `${v.log.length}:${v.log[0].at}` : '';
		if (this.logKey === key) return;
		this.logKey = key;
		this.lines.replaceChildren(
			...v.log.map((l) =>
				h('li', {}, h('time', { class: 'figure', datetime: l.at, text: clock.format(new Date(l.at)) }), h('span', { text: l.text }))
			)
		);
	}

	async act(work) {
		this.error.hidden = true;
		try {
			await work();
			poll();
		} catch (err) {
			if (err.status === 401) return signedOut();
			this.error.hidden = false;
			put(this.error, err.message);
		}
	}

	resize(by) {
		const v = this.view;
		if (!v) return;
		const n = Math.min(state.me.maxPhones, Math.max(1, v.phones + by));
		this.act(() => api('PATCH', `/api/runs/${encodeURIComponent(this.code)}`, { phones: n }));
	}

	halt() {
		this.act(() => api('DELETE', `/api/runs/${encodeURIComponent(this.code)}`));
	}

	restart() {
		const v = this.view;
		this.act(() => api('POST', '/api/runs', { code: this.code, phones: v.phones, pace: v.pace }));
	}

	dismiss() {
		this.act(() => api('DELETE', `/api/runs/${encodeURIComponent(this.code)}`));
	}
}

boot();
