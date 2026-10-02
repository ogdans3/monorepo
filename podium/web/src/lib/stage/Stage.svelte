<!--
	A slide, drawn the same everywhere: on the projector, on the editor's
	canvas and in the list of slides. Every place and size is percent of the
	16:9 stage and every type size is percent of its height, so the slide is
	the same slide at any size.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import OptionBox from './OptionBox.svelte';
	import QrTile from './QrTile.svelte';
	import Video from './Video.svelte';
	import { mark } from '$lib/answers';
	import { DARK, textOn } from '$lib/colour';
	import type { Slide } from '$lib/types';

	interface Props {
		slide: Slide;
		code: string;
		/** Where phones vote, for the QR code: this server, as the browser reached it. */
		origin?: string;
		/** «show» is the display, which plays videos; «edit» and «thumb» are stills. */
		mode?: 'show' | 'edit' | 'thumb';
		/** Answers whose count has just moved. */
		moving?: Record<string, boolean>;
		/** What marks the answers besides their colour. */
		marks?: 'letters' | 'numbers';
		/** An element the editor is drawing itself just now, as it is typed in. */
		hidden?: string | null;
		overlay?: Snippet;
	}

	let {
		slide,
		code,
		origin = location.origin,
		mode = 'show',
		moving = {},
		marks = 'letters',
		hidden = null,
		overlay
	}: Props = $props();

	const ink = $derived(textOn(slide.background));
</script>

<div
	class="stage"
	class:light={ink === DARK}
	data-mode={mode}
	style:background={slide.background}
	style:color={ink}
>
	<div class="plane">
		{#each slide.elements as el (el.id)}
			<div
				class="el"
				data-type={el.type}
				class:hidden={hidden === el.id}
				style:left="{el.x}%"
				style:top="{el.y}%"
				style:width="{el.w}%"
				style:height="{el.h}%"
			>
				{#if el.type === 'text'}
					<p
						class="text"
						class:bold={(el.weight ?? 400) >= 700}
						style:font-size="calc({el.size ?? 6} * var(--u))"
						style:text-align={el.align ?? 'left'}
						style:color={el.color || null}
					>{el.text}</p>
				{:else if el.type === 'image'}
					{#if el.media}
						<img src="/media/{el.media}" alt="" draggable="false" style:object-fit={el.fit ?? 'contain'} />
					{:else if mode !== 'show'}
						<div class="empty">Bilde</div>
					{/if}
				{:else if el.type === 'video'}
					{#if el.media}
						<Video {el} live={mode === 'show'} />
					{:else if mode !== 'show'}
						<div class="empty">Video</div>
					{/if}
				{:else if el.type === 'qr'}
					<!-- A narrow code is the corner one: the code to scan and the
					     presentation's code, without the address. -->
					<QrTile {code} {origin} compact={el.w < 15} />
				{/if}
			</div>
		{/each}
		{#each slide.options as option, i (option.id)}
			<div
				class="el"
				data-type="option"
				style:left="{option.x}%"
				style:top="{option.y}%"
				style:width="{option.w}%"
				style:height="{option.h}%"
			>
				<OptionBox {option} total={slide.total} mark={mark(i, marks)} moving={!!moving[option.id]} />
			</div>
		{/each}
		{@render overlay?.()}
	</div>
</div>

<style>
	.stage {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		container-type: size;
		overflow: hidden;
		font-family: var(--font);
		--change: var(--amber);
	}

	/* On a light slide the amber deepens, so a moving count still reads. */
	.stage.light {
		--change: var(--amber-deep);
	}

	.plane {
		position: absolute;
		inset: 0;
		--u: 1cqh;
	}

	.el {
		position: absolute;
	}

	.el.hidden {
		visibility: hidden;
	}

	.text {
		margin: 0;
		font-weight: 400;
		line-height: 1.24;
		letter-spacing: -0.004em;
		white-space: pre-wrap;
		overflow-wrap: break-word;
		text-wrap: pretty;
	}

	.text.bold {
		font-weight: 700;
		line-height: 1.08;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}

	img {
		width: 100%;
		height: 100%;
		user-select: none;
	}

	.empty {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border: max(1px, calc(var(--u) * 0.15)) dashed color-mix(in oklab, currentColor 40%, transparent);
		font-size: max(10px, calc(var(--u) * 2.6));
		font-weight: 560;
		opacity: 0.7;
	}

	[data-mode='thumb'] .empty {
		font-size: 0;
	}
</style>
