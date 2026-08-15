<script lang="ts">
	import { tick } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { OPERATOR, SITE_URL } from '$lib/site';
	import {
		REQUEST_KINDS,
		bodyFor,
		isSendable,
		mailtoFor,
		type FeedbackDraft,
		type RequestKind
	} from '$lib/feedback';
	import Breadcrumbs from '$lib/ui/Breadcrumbs.svelte';

	let kind = $state<RequestKind>('tool');
	let message = $state('');
	let replyTo = $state('');
	let copied = $state(false);
	/** Shown only when the clipboard is unavailable, so the text is still reachable. */
	let fallbackText = $state('');
	let fallbackBox = $state<HTMLTextAreaElement | null>(null);

	// Arriving from a tool page carries the path along, so a report about the
	// crop tool says so without anyone having to describe where they were.
	//
	// Read in the browser only. The page is prerendered, and one file of HTML
	// cannot depend on a query string, so SvelteKit refuses to let the server
	// look. Hydration fills it in a moment later, which is soon enough for a
	// line of context under a form nobody has typed into yet.
	const fromPath = $derived(browser ? (page.url.searchParams.get('from') ?? '') : '');
	const chosen = $derived(REQUEST_KINDS.find((k) => k.id === kind)!);
	const draft = $derived<FeedbackDraft>({
		kind,
		message,
		fromPath: fromPath || undefined,
		replyTo: replyTo || undefined
	});
	const ready = $derived(isSendable(draft));

	const context = () => ({ browser: navigator.userAgent });
	const mailto = $derived(ready ? mailtoFor(draft, OPERATOR.email, context()) : '');

	/**
	 * The clipboard API needs a secure context, so it is simply absent over
	 * plain HTTP and can be refused by permissions even over HTTPS. Neither is
	 * a reason to lose what someone just wrote, so the message goes into a box
	 * they can copy by hand instead.
	 */
	async function copy() {
		const text = bodyFor(draft, context());
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 2500);
		} catch {
			fallbackText = text;
			await tick();
			fallbackBox?.select();
		}
	}
</script>

<svelte:head>
	<title>Request a Feature - imagetoolbox</title>
	<meta
		name="description"
		content="Ask for a tool, a format or a fix. The message is written on your own device and opens in your own mail app, so it never passes through this site."
	/>
	<link rel="canonical" href="{SITE_URL}/feedback" />
	<meta property="og:title" content="Request a feature - imagetoolbox" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/feedback" />
</svelte:head>

<Breadcrumbs crumbs={[{ label: 'Home', href: '/' }]} current="Request a feature" />

<section class="hero">
	<h1>Ask for something</h1>
	<p class="lede">
		Missing a tool, a format, or found something broken? Say so. This is a one person operation,
		so the list of what to build next is mostly other people's requests.
	</p>
</section>

<section aria-labelledby="form-heading">
	<h2 id="form-heading" class="visually-hidden">The request</h2>

	<fieldset class="kinds">
		<legend>What is it about?</legend>
		<div class="chips">
			{#each REQUEST_KINDS as option (option.id)}
				<button
					type="button"
					class="chip"
					class:active={kind === option.id}
					aria-pressed={kind === option.id}
					onclick={() => (kind = option.id)}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</fieldset>

	<div class="field">
		<label for="message">Your request</label>
		<textarea id="message" bind:value={message} rows="7" placeholder={chosen.placeholder}
		></textarea>
	</div>

	<div class="field">
		<label for="reply">Your email, only if you want an answer</label>
		<input id="reply" type="email" bind:value={replyTo} placeholder="Optional" />
		<p class="hint">
			This goes in your own mail app, not into a form on this page. Leave it out and the message
			is still perfectly readable.
		</p>
	</div>

	{#if fromPath}
		<p class="hint context">
			The page you came from, <span class="mono">{fromPath}</span>, will be added at the bottom
			so there's no guessing about which tool you mean.
		</p>
	{/if}

	<div class="actions">
		{#if ready}
			<a class="btn" href={mailto}>Open in your mail app</a>
		{:else}
			<button class="btn" type="button" disabled>Open in your mail app</button>
		{/if}
		<button class="btn-ghost" type="button" onclick={copy} disabled={!ready}>
			{copied ? 'Copied' : 'Copy the message instead'}
		</button>
	</div>
	{#if !ready}
		<p class="hint">Write a sentence or two first, and the buttons wake up.</p>
	{/if}

	{#if fallbackText}
		<div class="field fallback">
			<label for="fallback">Your browser wouldn't let us reach the clipboard, so here it is</label>
			<textarea id="fallback" bind:this={fallbackBox} readonly rows="7">{fallbackText}</textarea>
		</div>
	{/if}
</section>

<section aria-labelledby="how-heading">
	<h2 id="how-heading">Where this goes</h2>
	<p>
		Nowhere, until you send it. There's no form handler behind this page and no third party
		collecting anything. The message is assembled in your browser and handed to your own mail app,
		which is the same arrangement as everything else here: the work happens on your device.
	</p>
	<p>
		If you would rather not use a mail app, copy the message and send it however you like, to
		<a href="mailto:{OPERATOR.email}">{OPERATOR.email}</a>.
	</p>
</section>

<section aria-labelledby="already-heading">
	<h2 id="already-heading">Worth checking first</h2>
	<p>
		There are more tools here than the front page shows. The
		<a href="/tools">image tools</a> cover crop, resize, compress, blur, redact and a good deal
		more, <a href="/pdf">PDF tools</a> handle merging and splitting, and
		<a href="/video">video</a> converts between MP4, MOV, MKV, AVI and WebM. Both tool hubs have a
		search box.
	</p>
</section>

<style>
	.kinds {
		border: 0;
		padding: 0;
		margin: 0 0 1.5rem;
	}

	.kinds legend {
		padding: 0;
		font-size: 0.875rem;
		font-weight: 600;
		margin-bottom: 0.6rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.field {
		margin-bottom: 1.4rem;
		max-width: 42rem;
	}

	.field label {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		margin-bottom: 0.4rem;
	}

	textarea,
	input[type='email'] {
		width: 100%;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
		font-size: 0.9375rem;
	}

	textarea {
		resize: vertical;
		line-height: 1.55;
	}

	textarea:focus-visible,
	input[type='email']:focus-visible {
		border-color: var(--primary);
	}

	.hint {
		margin: 0.45rem 0 0;
		font-size: 0.8125rem;
		color: var(--muted);
		max-width: 58ch;
	}

	.context {
		margin-bottom: 1.4rem;
	}

	.fallback {
		margin-top: 1.2rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
	}
</style>
