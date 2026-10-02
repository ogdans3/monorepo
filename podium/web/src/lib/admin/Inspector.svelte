<!--
	What the selection is, and everything that can be set on it. With nothing
	selected, the slide and the presentation: the background, the question as
	the phones show it, the sound of a vote and the files.
-->
<script lang="ts">
	import {
		AlignCenter,
		AlignLeft,
		AlignRight,
		BringToFront,
		Copy,
		Play,
		SendToBack,
		Trash2,
		Upload
	} from '@lucide/svelte';
	import Swatches from './Swatches.svelte';
	import { ANSWER_COLOURS, mark } from '$lib/answers';
	import { BACKGROUNDS, INKS, textOn } from '$lib/colour';
	import { chime } from '$lib/chime';
	import { bytes, share, votes } from '$lib/format';
	import { arrange, bounds, ANSWER_AREA } from '$lib/geometry';
	import { ballotUrl } from '$lib/qr';
	import { measure, type Editor } from './editor.svelte';
	import type { Media, Option, SlideElement } from '$lib/types';

	let { ed, place }: { ed: Editor; place: (file: File) => Promise<void> } = $props();

	const slide = $derived(ed.slide);
	const sel = $derived(ed.selection);
	const item = $derived(ed.selected);
	const el = $derived(sel?.kind === 'element' ? (item as SlideElement | undefined) : undefined);
	const option = $derived(sel?.kind === 'option' ? (item as Option | undefined) : undefined);
	const sounds = $derived(ed.media.filter((m) => m.kind === 'audio'));

	const KIND: Record<string, string> = { text: 'Tekst', image: 'Bilde', video: 'Video', qr: 'QR-kode' };

	function set<K extends keyof SlideElement>(key: K, value: SlideElement[K], run = true) {
		const id = el?.id;
		if (!id) return;
		ed.edit((s) => {
			const target = s.elements.find((e) => e.id === id);
			if (target) target[key] = value;
		}, run ? `${String(key)}:${id}` : true);
	}

	function setBox(key: 'x' | 'y' | 'w' | 'h', raw: string) {
		const v = Number(raw.replace(',', '.'));
		if (!item || !sel || !Number.isFinite(v)) return;
		const id = sel.id;
		ed.edit((s) => {
			const it = (sel.kind === 'element' ? s.elements : s.options).find((x) => x.id === id);
			if (!it) return;
			const lo = key === 'w' || key === 'h' ? 1 : 0;
			const far = key === 'x' || key === 'w' ? (key === 'x' ? 100 - it.w : 100 - it.x) : key === 'y' ? 100 - it.h : 100 - it.y;
			it[key] = Math.round(Math.max(lo, Math.min(far, v)) * 100) / 100;
		}, `box:${key}:${id}`);
	}

	function setColour(value: string) {
		const id = option?.id;
		if (!id) return;
		ed.edit((s) => {
			const o = s.options.find((x) => x.id === id);
			if (o) o.color = value || ANSWER_COLOURS[0];
		});
	}

	function setLabel(value: string) {
		const id = option?.id;
		if (!id) return;
		ed.edit((s) => {
			const o = s.options.find((x) => x.id === id);
			if (o) o.label = value;
		}, `label:${id}`);
	}

	function pickFile(accept: string, then: (file: File) => void) {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.onchange = () => input.files?.[0] && then(input.files[0]);
		input.click();
	}

	async function replaceMedia(kind: 'image' | 'video') {
		pickFile(kind === 'image' ? 'image/*' : 'video/*', async (file) => {
			const target = el?.id;
			const m = await ed.upload(file);
			if (!m || !target) return;
			if (m.kind !== kind) {
				ed.notice = `«${m.name}» er ikke ${kind === 'image' ? 'et bilde' : 'en video'}. Den ligger blant filene.`;
				return;
			}
			ed.edit((s) => {
				const e = s.elements.find((x) => x.id === target);
				if (e) e.media = m.id;
			});
		});
	}

	async function uploadSound() {
		pickFile('audio/*', async (file) => {
			const m = await ed.upload(file);
			if (!m) return;
			if (m.kind !== 'audio') {
				ed.notice = `«${m.name}» er ikke en lyd. Den ligger blant filene.`;
				return;
			}
			await ed.setSound(m.id);
		});
	}

	function evenly() {
		const s = slide;
		if (!s || s.options.length === 0) return;
		const area = s.options.length > 1 ? bounds(s.options) : null;
		ed.placeOptions(arrange(s.options.length, area && area.w > 20 && area.h > 15 ? area : ANSWER_AREA));
	}

	function usedOn(m: Media): number {
		return ed.slides.filter((s) => s.elements.some((e) => e.media === m.id)).length;
	}
</script>

<aside class="inspector" aria-label="Egenskaper">
	{#if el && slide}
		<section>
			<h2>{KIND[el.type]}</h2>

			{#if el.type === 'text'}
				<label class="field">
					<span>Tekst</span>
					<textarea class="input" rows="4" value={el.text} oninput={(e) => ed.setText(el, e.currentTarget.value)}
					></textarea>
				</label>
				<div class="field">
					<span id="size-label">Størrelse, i prosent av sidens høyde</span>
					<div class="range">
						<input
							type="range"
							min="1.5"
							max="24"
							step="0.5"
							value={el.size ?? 6}
							aria-labelledby="size-label"
							oninput={(e) => set('size', Number(e.currentTarget.value))}
						/>
						<input
							class="input tabular"
							type="number"
							min="1"
							max="40"
							step="0.5"
							value={el.size ?? 6}
							aria-labelledby="size-label"
							oninput={(e) => {
								const v = Number(e.currentTarget.value);
								if (v >= 1 && v <= 40) set('size', v);
							}}
						/>
					</div>
				</div>
				<div class="pair">
					<div class="field">
						<span>Vekt</span>
						<div class="segments" role="radiogroup" aria-label="Vekt">
							<button role="radio" aria-checked={(el.weight ?? 400) < 700} onclick={() => set('weight', 400, false)}>Normal</button>
							<button role="radio" aria-checked={(el.weight ?? 400) >= 700} onclick={() => set('weight', 700, false)}><b>Fet</b></button>
						</div>
					</div>
					<div class="field">
						<span>Justering</span>
						<div class="segments" role="radiogroup" aria-label="Justering">
							<button role="radio" aria-checked={(el.align ?? 'left') === 'left'} aria-label="Venstre" title="Venstre" onclick={() => set('align', 'left', false)}><AlignLeft size={16} strokeWidth={1.75} /></button>
							<button role="radio" aria-checked={el.align === 'center'} aria-label="Midtstilt" title="Midtstilt" onclick={() => set('align', 'center', false)}><AlignCenter size={16} strokeWidth={1.75} /></button>
							<button role="radio" aria-checked={el.align === 'right'} aria-label="Høyre" title="Høyre" onclick={() => set('align', 'right', false)}><AlignRight size={16} strokeWidth={1.75} /></button>
						</div>
					</div>
				</div>
				<div class="field">
					<span>Farge</span>
					<Swatches
						label="Tekstfarge"
						value={el.color ?? ''}
						colours={INKS}
						auto={textOn(slide.background)}
						onpick={(c) => set('color', c, false)}
					/>
				</div>
			{:else if el.type === 'image' || el.type === 'video'}
				{@const kind = el.type}
				{@const choices = ed.media.filter((m) => m.kind === kind)}
				<label class="field">
					<span>Fil</span>
					<select class="input" value={el.media ?? ''} onchange={(e) => set('media', e.currentTarget.value, false)}>
						<option value="" disabled>{choices.length ? 'Velg en fil' : 'Ingen filer ennå'}</option>
						{#each choices as m (m.id)}
							<option value={m.id}>{m.name}</option>
						{/each}
					</select>
				</label>
				<button class="btn small" onclick={() => replaceMedia(kind)}>
					<Upload size={15} strokeWidth={1.75} />Last opp {kind === 'image' ? 'et bilde' : 'en video'}
				</button>
				<div class="field">
					<span>I boksen</span>
					<div class="segments" role="radiogroup" aria-label="Hvordan den fyller boksen">
						<button role="radio" aria-checked={(el.fit ?? 'contain') === 'contain'} onclick={() => set('fit', 'contain', false)}>Vis hele</button>
						<button role="radio" aria-checked={el.fit === 'cover'} onclick={() => set('fit', 'cover', false)}>Fyll boksen</button>
					</div>
				</div>
				{#if kind === 'video'}
					<div class="checks">
						<label><input type="checkbox" checked={!!el.autoplay} onchange={(e) => set('autoplay', e.currentTarget.checked, false)} />Spill av når siden vises</label>
						<label><input type="checkbox" checked={!!el.loop} onchange={(e) => set('loop', e.currentTarget.checked, false)} />Gjenta</label>
						<label><input type="checkbox" checked={!!el.muted} onchange={(e) => set('muted', e.currentTarget.checked, false)} />Uten lyd</label>
					</div>
					<p class="hint">På visningen starter og stopper et klikk på videoen den.</p>
				{/if}
			{:else if el.type === 'qr'}
				<p class="hint">
					Telefonene som skanner koden kommer rett til avstemningen. Under koden står adressen og presentasjonens kode, for dem som
					heller vil skrive.
				</p>
				<p class="url">{ballotUrl(location.origin, ed.p.code)}</p>
			{/if}
		</section>
		{@render placement(true)}
	{:else if option && slide}
		{@const index = slide.options.findIndex((o) => o.id === option.id)}
		<section>
			<h2>Svar {mark(index, ed.p.marks)}</h2>
			<label class="field">
				<span>Svaret</span>
				<input class="input" value={option.label} maxlength="200" oninput={(e) => setLabel(e.currentTarget.value)} />
			</label>
			<div class="field">
				<span>Farge, på siden og på telefonene</span>
				<Swatches label="Svarets farge" value={option.color} colours={ANSWER_COLOURS} onpick={setColour} />
			</div>
			<p class="tally"><span class="figure">{votes(option.count)}</span><span class="quiet tabular">{share(option.count, slide.total)}</span></p>
			<p class="hint">
				Svaret står på siden der du legger det. På telefonene er det en flis i samme farge, med {ed.p.marks === 'numbers' ? 'tallet' : 'bokstaven'}
				{mark(index, ed.p.marks)}.
			</p>
		</section>
		{@render placement(false)}
	{:else if slide}
		<section>
			<h2>Siden</h2>
			<div class="field">
				<span>Bakgrunn</span>
				<Swatches
					label="Bakgrunnsfarge"
					value={slide.background}
					colours={BACKGROUNDS}
					onpick={(c) => ed.edit((s) => (s.background = c || '#111418'), 'background')}
				/>
			</div>
			{#if slide.options.length > 0}
				<label class="field">
					<span>Spørsmålet på telefonene</span>
					<input
						class="input"
						value={slide.title}
						maxlength="300"
						placeholder="Hva lurer du på?"
						oninput={(e) => {
							const v = e.currentTarget.value;
							ed.edit((s) => (s.title = v), 'title');
						}}
					/>
				</label>
				<p class="hint">Følger teksten på siden så lenge de er like. Skriv noe annet her for å la dem være forskjellige.</p>
				<div class="row">
					<p class="figure big">{votes(slide.total)}</p>
					<button class="btn small" disabled={slide.total === 0} onclick={() => ed.resetVotes()}>Nullstill</button>
				</div>
				<button class="btn small" onclick={evenly}>Fordel svarene jevnt</button>
			{:else}
				<p class="hint">Legg til et svar med «Svar» over siden for å gjøre den til et spørsmål salen kan stemme på.</p>
			{/if}
		</section>

		<section>
			<h2>Presentasjonen</h2>
			<div class="field">
				<span id="marks-label">Svarene merkes med</span>
				<div class="segments" role="radiogroup" aria-labelledby="marks-label">
					<button role="radio" aria-checked={ed.p.marks !== 'numbers'} onclick={() => ed.setMarks('letters')}>A B C</button>
					<button role="radio" aria-checked={ed.p.marks === 'numbers'} onclick={() => ed.setMarks('numbers')}>1 2 3</button>
				</div>
			</div>
			<div class="field" role="radiogroup" aria-labelledby="sound-label">
				<span id="sound-label">Lyd for hver stemme</span>
				<div class="sounds">
					<label class="sound">
						<input type="radio" name="sound" checked={!ed.p.soundMediaId} onchange={() => ed.setSound('')} />
						<span>Klokke</span>
						<button class="btn quiet icon small" aria-label="Hør klokken" title="Hør" onclick={() => chime.preview()}><Play size={14} strokeWidth={2} /></button>
					</label>
					{#each sounds as m (m.id)}
						<label class="sound">
							<input type="radio" name="sound" checked={ed.p.soundMediaId === m.id} onchange={() => ed.setSound(m.id)} />
							<span class="name">{m.name}</span>
							<button class="btn quiet icon small" aria-label="Hør {m.name}" title="Hør" onclick={() => chime.preview(m.url)}><Play size={14} strokeWidth={2} /></button>
						</label>
					{/each}
				</div>
				<button class="btn small" onclick={uploadSound}><Upload size={15} strokeWidth={1.75} />Last opp en lyd</button>
			</div>

			<div class="field">
				<span>Filer</span>
				{#if ed.media.length === 0}
					<p class="hint">Bilder, video og lyd du laster opp ligger her. Dra en fil rett på siden for å legge den der.</p>
				{:else}
					<ul class="files" role="list">
						{#each ed.media as m (m.id)}
							{@const n = usedOn(m)}
							<li>
								{#if m.kind === 'image'}
									<img src={m.url} alt="" loading="lazy" />
								{:else}
									<span class="kind">{m.kind === 'video' ? 'Video' : 'Lyd'}</span>
								{/if}
								<span class="meta">
									<span class="name" title={m.name}>{m.name}</span>
									<span class="quiet tabular">{bytes(m.size)}{n ? ` · på ${n} ${n === 1 ? 'side' : 'sider'}` : ''}</span>
								</span>
								{#if m.kind !== 'audio'}
									<button class="btn quiet small" onclick={async () => ed.addMedia(m, await measure(m))}>Legg på</button>
								{/if}
								<button class="btn quiet icon small" aria-label="Slett {m.name}" title="Slett" onclick={() => ed.deleteMedia(m)}><Trash2 size={14} strokeWidth={1.75} /></button>
							</li>
						{/each}
					</ul>
				{/if}
				<button class="btn small" onclick={() => pickFile('image/*,video/*,audio/*', place)}><Upload size={15} strokeWidth={1.75} />Last opp en fil</button>
			</div>
		</section>
	{/if}
</aside>

{#snippet placement(isElement: boolean)}
	{#if item}
		<section>
			<h2 class="minor">Plassering</h2>
			<div class="box">
				{#each [['x', 'Fra venstre'], ['y', 'Fra toppen'], ['w', 'Bredde'], ['h', 'Høyde']] as [key, label] (key)}
					<label class="field">
						<span>{label}</span>
						<span class="unit">
							<input
								class="input tabular"
								type="number"
								step="0.5"
								value={Math.round(item[key as 'x'] * 100) / 100}
								onchange={(e) => setBox(key as 'x', e.currentTarget.value)}
							/>
							<span aria-hidden="true">%</span>
						</span>
					</label>
				{/each}
			</div>
			<div class="actions">
				{#if isElement}
					<button class="btn quiet icon small" aria-label="Fremst" title="Fremst" onclick={() => ed.restack(true)}><BringToFront size={16} strokeWidth={1.75} /></button>
					<button class="btn quiet icon small" aria-label="Bakerst" title="Bakerst" onclick={() => ed.restack(false)}><SendToBack size={16} strokeWidth={1.75} /></button>
				{/if}
				<button class="btn quiet small" onclick={() => ed.duplicateSelected()}><Copy size={15} strokeWidth={1.75} />Dupliser</button>
				<button class="btn quiet small danger" onclick={() => ed.removeSelected()}><Trash2 size={15} strokeWidth={1.75} />Slett</button>
			</div>
		</section>
	{/if}
{/snippet}

<style>
	.inspector {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		border-left: 1px solid var(--rule);
		background: var(--desk);
	}

	section {
		display: grid;
		gap: 1rem;
		padding: 1.1rem 1.1rem 1.4rem;
		border-bottom: 1px solid var(--rule);
	}

	h2 {
		font-size: 0.9375rem;
		font-weight: 700;
		letter-spacing: -0.005em;
	}

	h2.minor {
		font-size: 0.8125rem;
		color: var(--quiet);
		font-weight: 650;
	}

	.range {
		display: grid;
		grid-template-columns: 1fr 4rem;
		align-items: center;
		gap: 0.6rem;
	}

	input[type='range'] {
		width: 100%;
		accent-color: var(--desk-text);
	}

	.pair {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.8rem;
	}

	.segments {
		display: inline-flex;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius);
		overflow: hidden;
		justify-self: start;
	}

	.segments button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		height: 1.875rem;
		padding: 0 0.6rem;
		border: 0;
		border-right: 1px solid var(--rule);
		background: transparent;
		font-size: 0.8125rem;
		font-weight: 520;
	}

	.segments button:last-child {
		border-right: 0;
	}

	.segments button:hover {
		background: var(--sunk);
	}

	.segments button[aria-checked='true'] {
		background: var(--desk-text);
		color: var(--desk);
	}

	.checks {
		display: grid;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.checks label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.hint {
		color: var(--quiet);
		font-size: 0.8125rem;
		line-height: 1.45;
	}

	.url {
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}

	.tally {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.tally .figure {
		font-size: 1.5rem;
	}

	.quiet {
		color: var(--quiet);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.big {
		font-size: 1.5rem;
	}

	section > .btn {
		justify-self: start;
	}

	.field > .btn {
		justify-self: start;
		margin-top: 0.2rem;
	}

	.sounds {
		display: grid;
		border-top: 1px solid var(--rule);
	}

	.sound {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.55rem;
		min-height: 2.4rem;
		border-bottom: 1px solid var(--rule);
		font-size: 0.875rem;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.files {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--rule);
	}

	.files li {
		display: grid;
		grid-template-columns: 2.5rem minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.55rem;
		min-height: 3rem;
		padding: 0.35rem 0;
		border-bottom: 1px solid var(--rule);
		font-size: 0.8125rem;
	}

	.files img,
	.files .kind {
		width: 2.5rem;
		height: 2rem;
		object-fit: cover;
		border-radius: 2px;
		background: var(--sunk);
	}

	.files .kind {
		display: grid;
		place-items: center;
		color: var(--quiet);
		font-size: 0.6875rem;
		font-weight: 600;
	}

	.meta {
		display: grid;
		min-width: 0;
	}

	.box {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem 0.8rem;
	}

	.unit {
		position: relative;
	}

	.unit .input {
		padding-right: 1.5rem;
	}

	.unit > span {
		position: absolute;
		right: 0.55rem;
		top: 50%;
		translate: 0 -50%;
		color: var(--quiet);
		font-size: 0.8125rem;
		pointer-events: none;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-left: -0.5rem;
	}
</style>
