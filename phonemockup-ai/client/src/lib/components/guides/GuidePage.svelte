<script lang="ts">
  import { ArrowUpRight } from "@lucide/svelte";
  import GuideShell from "./GuideShell.svelte";
  import GuideHead from "./GuideHead.svelte";
  import GuideStage from "./GuideStage.svelte";
  import GuideList from "./GuideList.svelte";
  import Paragraph from "./Paragraph.svelte";
  import {
    guidePath,
    hubFor,
    relatedGuides,
    type Guide,
  } from "$lib/guides/guides";
  import { deviceOf, motionsFor } from "$lib/guides/motions";

  let { guide }: { guide: Guide } = $props();

  const hub = $derived(hubFor(guide.section));
  const motions = $derived(motionsFor(guide.motions));
  // Re-derives when another guide opens; a click overrides it until then.
  let selectedId = $derived(guide.motions[0]);
  const selected = $derived(
    motions.find((motion) => motion.id === selectedId) ?? motions[0],
  );
  const studio = $derived(`/platform/animation/${selected.id}`);
  // Like the landing's "Your work. / Every angle.": after the first comma, the
  // headline steps back to the muted ink.
  const headline = $derived.by(() => {
    const at = guide.h1.indexOf(",");
    return at < 0
      ? { lead: guide.h1, rest: "" }
      : { lead: guide.h1.slice(0, at + 1), rest: guide.h1.slice(at + 1) };
  });
</script>

<GuideHead
  title={guide.title}
  description={guide.description}
  path={guidePath(guide)}
  crumbs={[
    { name: "PhoneMockup", path: "/" },
    { name: hub.name, path: `/${hub.section}` },
    { name: guide.name, path: guidePath(guide) },
  ]}
/>

<GuideShell section={guide.section}>
  <nav class="crumbs wrap" aria-label="Breadcrumb">
    <ol>
      <li><a href="/">PhoneMockup</a></li>
      <li><a href={`/${hub.section}`}>{hub.name}</a></li>
      <li><span aria-current="page">{guide.name}</span></li>
    </ol>
  </nav>

  <section class="g-hero wrap" aria-labelledby="guide-title">
    <div class="g-hero-copy">
      <h1 id="guide-title">
        {headline.lead}{#if headline.rest}<span class="soft"
            >{headline.rest}</span
          >{/if}
      </h1>
      <p class="g-lead">{guide.lead}</p>
      <div class="g-actions">
        <a class="button primary" href={studio}
          >{guide.cta} <ArrowUpRight size={20} /></a
        >
        <span class="g-proof">Free during beta. No watermark. No account.</span>
      </div>
      <p class="g-opens" aria-live="polite">
        Opens the studio with <strong>{selected.name}</strong> on the {deviceOf(
          selected,
        )}. Every keyframe stays editable.
      </p>
    </div>
    <GuideStage
      {motions}
      {selected}
      onselect={(id) => {
        selectedId = id;
      }}
    />
  </section>

  {#if guide.comparison}
    <section class="g-compare wrap" aria-labelledby="compare-title">
      <div class="g-compare-head">
        <h2 id="compare-title">Side by side.</h2>
        <p>{guide.comparison.checked}</p>
      </div>
      <table>
        <caption class="sr-only"
          >PhoneMockup and {guide.comparison.them}, compared</caption
        >
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">Compared</span></th>
            <th scope="col" class="us">PhoneMockup</th>
            <th scope="col">{guide.comparison.them}</th>
          </tr>
        </thead>
        <tbody>
          {#each guide.comparison.rows as row}
            <tr>
              <th scope="row">{row.label}</th>
              <td data-label="PhoneMockup">{row.us}</td>
              <td data-label={guide.comparison.them}>{row.them}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}

  <div class="g-body wrap" class:g-body-wide={!guide.facts?.length}>
    {#if guide.facts?.length}
      <section class="g-facts" aria-labelledby="facts-title">
        <h2 id="facts-title">The short version.</h2>
        <dl>
          {#each guide.facts as fact}
            <div>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          {/each}
        </dl>
      </section>
    {/if}
    <div class="g-passages">
      {#each guide.passages as passage, i}
        <section class="g-passage" aria-labelledby={`passage-${i}`}>
          <h2 id={`passage-${i}`}>{passage.heading}</h2>
          {#each passage.body as text}<Paragraph {text} />{/each}
        </section>
      {/each}
    </div>
  </div>

  <section class="g-faq wrap" aria-labelledby="faq-title">
    <h2 id="faq-title">Good to know.</h2>
    <div class="g-faq-list">
      {#each guide.faqs as item}
        <article>
          <h3>{item.q}</h3>
          <p>{item.a}</p>
        </article>
      {/each}
    </div>
  </section>

  <section class="g-related wrap" aria-labelledby="related-title">
    <h2 id="related-title">More guides.</h2>
    <GuideList guides={relatedGuides(guide)} showSection />
  </section>

  <section class="g-final wrap" aria-labelledby="final-title">
    <h2 id="final-title">Let’s see it.</h2>
    <div class="g-final-actions">
      <a class="button primary" href={studio}
        >{guide.cta} <ArrowUpRight size={21} /></a
      >
      <span class="g-proof">Free during beta. No watermark. No account.</span>
    </div>
  </section>
</GuideShell>
