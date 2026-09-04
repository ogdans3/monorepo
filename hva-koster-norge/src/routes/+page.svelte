<script lang="ts">
	import Merkefelt from '$lib/Merkefelt.svelte';
	import { ÅRSLØNN, VEDTATT, sortertePoster, sum } from '$lib/data';
	import { andel, iLønninger, kroner, lønningerTekst, merkeskala, storBeløp } from '$lib/format';

	const poster = sortertePoster(VEDTATT);
	const total = sum(VEDTATT);
	const totaltILønninger = iLønninger(total, ÅRSLØNN.årslønn);

	/**
	 * One scale for every field on the page, derived from the largest of them.
	 *
	 * This is the load-bearing decision. Let each field choose its own and the
	 * page fills with rectangles that all look the same size, which is worse
	 * than no picture at all: it tells the reader that bistand and
	 * alderspensjon are comparable, and they are not.
	 *
	 * The cap is what the biggest field may draw. Everything else lands where
	 * it lands, and a small post being a thin strip next to a deep block is not
	 * a layout problem to solve. It is the finding.
	 */
	const MAKS_MERKER = 20_000;
	const SKALA = merkeskala(totaltILønninger, MAKS_MERKER);

	const skalaTekst =
		SKALA === 1
			? 'Ett merke er én årslønn.'
			: `Ett merke er ${kroner(SKALA)} årslønner, og det er den samme målestokken i alle feltene på siden.`;

	function lønningerFor(beløp: number) {
		return iLønninger(beløp, ÅRSLØNN.årslønn);
	}
</script>

<svelte:head>
	<title>Hva koster Norge? Statsbudsjettet i årslønner</title>
	<meta
		name="description"
		content="Statsbudsjettet regnet om til vanlige årslønner, så tallene blir mulige å kjenne på. Med partienes alternative budsjetter ved siden av."
	/>
</svelte:head>

{#if VEDTATT.foreløpig}
	<aside class="advarsel">
		<strong>Tallene i budsjettet er foreløpige.</strong> De er satt inn for å bygge og vurdere siden,
		og de er ikke hentet fra statsbudsjettet. Lønnstallet er ekte. Ingenting her kan siteres ennå.
	</aside>
{/if}

<section class="apning">
	<h1>Hva koster Norge?</h1>

	<p class="ingress">
		Statsbudsjettet er på <strong class="num">{storBeløp(total)}</strong> kroner. Det tallet er så
		stort at det ikke betyr noe. Så her er det i noe du kjenner igjen: en helt vanlig årslønn.
	</p>
</section>

<section class="lonn">
	<p class="etikett">Én gjennomsnittlig årslønn i Norge</p>
	<p class="stortall num">{kroner(ÅRSLØNN.årslønn)} kr</p>
	<p class="under">
		{kroner(ÅRSLØNN.månedslønn)} kroner i måneden, ganger tolv. {ÅRSLØNN.beskrivelse}, for
		{ÅRSLØNN.år}.
		<a href={ÅRSLØNN.kilde.url} rel="noreferrer">{ÅRSLØNN.kilde.navn}</a>
	</p>
	<div class="enmerke">
		<Merkefelt antallLønninger={1} skala={1} animer={false} />
		<span>Én årslønn er ett merke. Alt under er bygget av dette.</span>
	</div>
</section>

<section class="felt-seksjon">
	<h2>Hele budsjettet</h2>
	<p>
		Delt på en vanlig årslønn blir statsbudsjettet
		<strong class="num">{lønningerTekst(totaltILønninger)}</strong>. Feltet under er alle sammen.
	</p>
	<Merkefelt antallLønninger={totaltILønninger} skala={SKALA} />
	<p class="skala">{skalaTekst}</p>
</section>

<section class="poster">
	<h2>Hvor pengene går</h2>
	<p class="innledning">
		Postene står etter størrelse, den største først. Det er hele regelen, og den er ikke valgt
		for å framheve noe spesielt.
	</p>

	{#each poster as post (post.id)}
		{@const lønninger = lønningerFor(post.beløp)}
		<article class="post">
			<h3>{post.navn}</h3>
			<p class="tall">
				<span class="num">{storBeløp(post.beløp)}</span>
				<span class="del num">{andel(post.beløp, total)} av budsjettet</span>
			</p>
			<Merkefelt antallLønninger={lønninger} skala={SKALA} />
			<p class="skala">{lønningerTekst(lønninger)}</p>
			<p class="forklaring">{post.forklaring}</p>
		</article>
	{/each}
</section>

<style>
	.advarsel {
		background: var(--surface);
		border-bottom: 2px solid var(--accent);
		padding: var(--space-3);
		font-size: var(--t-s);
	}

	.advarsel strong {
		display: block;
		color: var(--accent);
	}

	section {
		max-width: var(--measure);
		margin-inline: auto;
		padding-inline: var(--space-3);
	}

	.apning {
		padding-top: var(--space-5);
	}

	.ingress {
		margin-top: var(--space-3);
		font-size: var(--t-l);
		line-height: 1.45;
	}

	.lonn {
		margin-top: var(--space-5);
	}

	/*
	 * The label sits above the figure it names, tight, because they are one
	 * unit. The gap below is generous. That contrast is the rhythm.
	 */
	.etikett {
		color: var(--muted);
		font-size: var(--t-s);
		font-weight: 600;
	}

	.stortall {
		font-size: var(--t-2xl);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.1;
		margin-top: var(--space-1);
	}

	.under {
		margin-top: var(--space-2);
		color: var(--muted);
		font-size: var(--t-s);
	}

	.enmerke {
		margin-top: var(--space-3);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--t-xs);
		color: var(--muted);
	}

	/* One mark is 3px, so it needs a box of its own or it disappears. */
	.enmerke :global(.felt) {
		width: 4px;
		flex: none;
	}

	.felt-seksjon {
		margin-top: var(--space-6);
	}

	.felt-seksjon p {
		margin-top: var(--space-2);
		margin-bottom: var(--space-3);
	}

	.skala {
		margin-top: var(--space-2);
		color: var(--muted);
		font-size: var(--t-xs);
	}

	.poster {
		margin-top: var(--space-6);
	}

	.innledning {
		margin-top: var(--space-2);
		color: var(--muted);
		font-size: var(--t-s);
	}

	.post {
		margin-top: var(--space-5);
		padding-top: var(--space-3);
		border-top: 1px solid var(--line);
	}

	.tall {
		margin: var(--space-1) 0 var(--space-3);
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
		font-size: var(--t-l);
		font-weight: 700;
	}

	.del {
		font-size: var(--t-s);
		font-weight: 400;
		color: var(--muted);
	}

	.forklaring {
		margin-top: var(--space-2);
		font-size: var(--t-s);
	}
</style>
