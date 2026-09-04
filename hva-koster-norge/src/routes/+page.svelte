<script lang="ts">
	import Merkefelt from '$lib/Merkefelt.svelte';
	import Figur from '$lib/Figur.svelte';
	import { ÅRSLØNN, LØNNSTAKERE, VEDTATT, sortertePoster, sum } from '$lib/data';
	import {
		andel,
		iLønninger,
		kroner,
		merkeskala,
		perÅrslønn,
		rundtBeløp,
		storBeløp
	} from '$lib/format';

	const poster = sortertePoster(VEDTATT);
	const total = sum(VEDTATT);
	const totaltILønninger = iLønninger(total, ÅRSLØNN.årslønn);

	const ÅRSLØNNER = LØNNSTAKERE.heltidsekvivalenter;
	const totalPerÅrslønn = perÅrslønn(total, ÅRSLØNNER);
	/** What every full salary in Norway adds up to, for the comparison below. */
	const samletLønn = ÅRSLØNNER * ÅRSLØNN.årslønn;

	/**
	 * How the budget compares to the country's whole wage bill, in words.
	 *
	 * Derived rather than written, because the first version hardcoded "nesten
	 * like mye" next to a computed ratio. With the placeholder figures that
	 * ratio is 71%, so the sentence was already false, and it would have
	 * silently become false again every time a real budget moved. A qualitative
	 * claim sitting beside a number it does not read is a bug waiting for a
	 * year when the number changes.
	 */
	const lønnsforhold = total / samletLønn;
	// The whole clause, not two swapped words. "mer enn" and "omtrent like mye
	// som" take different sentence frames, and splicing one into the other's
	// frame produced "bruker mindre enn på ett år som det utbetales", which is
	// not Norwegian.
	const sammenligning =
		lønnsforhold >= 0.95 && lønnsforhold <= 1.05
			? 'omtrent like mye på ett år som det som utbetales i lønn i hele Norge'
			: lønnsforhold > 1.05
				? 'mer på ett år enn alt som utbetales i lønn i hele Norge'
				: 'mindre på ett år enn alt som utbetales i lønn i hele Norge';

	/**
	 * One scale for every field on the page, derived from the largest of them.
	 *
	 * This is the load-bearing decision. Let each field choose its own and the
	 * page fills with rectangles that all look the same size, which is worse
	 * than no picture at all: it tells the reader that bistand and
	 * alderspensjon are comparable, and they are not.
	 */
	const MAKS_MERKER = 20_000;
	const SKALA = merkeskala(totaltILønninger, MAKS_MERKER);

	const skalaTekst =
		SKALA === 1
			? 'Ett merke er én årslønn.'
			: `Ett merke er ${kroner(SKALA)} årslønner, og det er den samme målestokken i alle feltene på siden.`;
</script>

<svelte:head>
	<title>Hva koster Norge? Statsbudsjettet per årslønn</title>
	<meta
		name="description"
		content="Statsbudsjettet fordelt på hver årslønn i Norge, så tallene blir mulige å kjenne på. Med partienes alternative budsjetter ved siden av."
	/>
</svelte:head>

{#if VEDTATT.foreløpig}
	<aside class="advarsel">
		<strong>Tallene i budsjettet er foreløpige.</strong> De er satt inn for å bygge og vurdere siden,
		og de er ikke hentet fra statsbudsjettet. Lønnstallene er ekte. Ingenting her kan siteres ennå.
	</aside>
{/if}

<section class="apning">
	<h1>Hva koster Norge?</h1>

	<p class="ingress">
		Statsbudsjettet er på <strong>{storBeløp(total)}</strong> kroner. Det tallet er så
		stort at det ikke betyr noe. Så her er det delt på noe du kjenner igjen: hver eneste årslønn i
		landet.
	</p>
</section>

<section class="hovedtall">
	<p class="etikett">Statsbudsjettet, delt på hver årslønn i Norge</p>
	<p class="stortall num">{rundtBeløp(totalPerÅrslønn)} kr</p>
	<p class="under">
		Det er <strong>{andel(totalPerÅrslønn, ÅRSLØNN.årslønn)}</strong> av en vanlig årslønn på
		{kroner(ÅRSLØNN.årslønn)} kroner. Sagt på en annen måte: staten bruker {sammenligning}, som er
		{storBeløp(samletLønn)} kroner.
	</p>

	<p class="forbehold">
		Dette er en divisjon, ikke en regning. Staten får ikke pengene sine fra lønn alene, men også
		fra selskapsskatt, moms og en stor overføring fra oljefondet, så «dette koster deg» ville vært
		feil. «Fordelt på hver årslønn i landet blir det så mye» er riktig.
	</p>

	<p class="kilder">
		{kroner(ÅRSLØNN.månedslønn)} kroner i måneden ganger tolv, og {kroner(ÅRSLØNNER)} heltidsekvivalenter,
		begge for {ÅRSLØNN.år}. <a href={ÅRSLØNN.kilde.url} rel="noreferrer">{ÅRSLØNN.kilde.navn}</a>
	</p>
</section>

<section class="felt-seksjon">
	<h2>Hele budsjettet</h2>
	<p>Feltet under er hele statsbudsjettet. Hvert merke er penger noen har jobbet et år for.</p>
	<Merkefelt antallLønninger={totaltILønninger} skala={SKALA} />
	<p class="skala">{skalaTekst}</p>
</section>

<section class="poster">
	<h2>Hvor pengene går</h2>
	<p class="innledning">
		Beløpene er hva hver post kommer til per årslønn i landet. Postene står etter størrelse, den
		største først. Det er hele regelen, og den er ikke valgt for å framheve noe.
	</p>

	{#each poster as post (post.id)}
		{@const per = perÅrslønn(post.beløp, ÅRSLØNNER)}
		<article class="post">
			<div class="topp">
				<Figur navn={post.figur} />
				<div class="tekst">
					<h3>{post.navn}</h3>
					<p class="perlonn num">{rundtBeløp(per)} kr</p>
					<p class="bi num">
						per årslønn · {storBeløp(post.beløp)} i alt · {andel(post.beløp, total)} av budsjettet
					</p>
				</div>
			</div>
			<Merkefelt antallLønninger={iLønninger(post.beløp, ÅRSLØNN.årslønn)} skala={SKALA} />
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

	.hovedtall {
		margin-top: var(--space-5);
	}

	/*
	 * The label sits tight above the figure it names, because they are one
	 * unit. The gap below is generous. That contrast is the rhythm.
	 */
	.etikett {
		color: var(--muted);
		font-size: var(--t-s);
		font-weight: 600;
	}

	.stortall {
		font-size: clamp(2.6rem, 13vw, 3.6rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1;
		margin-top: var(--space-1);
	}

	.under {
		margin-top: var(--space-3);
	}

	.forbehold {
		margin-top: var(--space-3);
		padding-top: var(--space-2);
		border-top: 1px solid var(--line);
		font-size: var(--t-s);
		color: var(--muted);
	}

	.kilder {
		margin-top: var(--space-2);
		font-size: var(--t-xs);
		color: var(--muted);
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

	/* The drawing and the figure it belongs to travel together. */
	.topp {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
	}

	.tekst {
		min-width: 0;
	}

	.perlonn {
		font-size: var(--t-xl);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.1;
		margin-top: var(--space-1);
	}

	.bi {
		margin-top: var(--space-1);
		font-size: var(--t-xs);
		color: var(--muted);
	}

	.forklaring {
		margin-top: var(--space-2);
		font-size: var(--t-s);
	}
</style>
