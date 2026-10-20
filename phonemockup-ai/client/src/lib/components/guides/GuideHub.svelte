<script lang="ts">
  import { ArrowUpRight } from "@lucide/svelte";
  import MotionPreview from "$lib/components/marketing/MotionPreview.svelte";
  import GuideShell from "./GuideShell.svelte";
  import GuideHead from "./GuideHead.svelte";
  import GuideStage from "./GuideStage.svelte";
  import { guidePath, hubGuides, type GuideHub } from "$lib/guides/guides";
  import { background, motionsFor } from "$lib/guides/motions";

  let { hub }: { hub: GuideHub } = $props();

  const groups = $derived(hubGuides(hub));
  const stage = $derived(hub.motion ? motionsFor([hub.motion])[0] : undefined);
  // One row per group on a desktop; guides.css drops to three columns, then two.
  const columns = (count: number) => Math.min(count, 5);
</script>

<GuideHead
  title={hub.title}
  description={hub.description}
  path={`/${hub.section}`}
  crumbs={[
    { name: "PhoneMockup", path: "/" },
    { name: hub.name, path: `/${hub.section}` },
  ]}
/>

<GuideShell section={hub.section} isHub>
  <nav class="crumbs wrap" aria-label="Breadcrumb">
    <ol>
      <li><a href="/">PhoneMockup</a></li>
      <li><span aria-current="page">{hub.name}</span></li>
    </ol>
  </nav>

  <section class="g-hub-head wrap" aria-labelledby="hub-title">
    <h1 id="hub-title">{hub.h1}</h1>
    <p>{hub.lead}</p>
  </section>

  {#if hub.body?.length}
    <div class="g-hub-body wrap" class:with-stage={!!stage}>
      <div class="g-hub-text">
        {#each hub.body as text}<p>{text}</p>{/each}
      </div>
      {#if stage}<GuideStage motions={[stage]} selected={stage} compact />{/if}
    </div>
  {/if}

  {#each groups as group, i}
    <section class="g-group wrap" aria-labelledby={`group-${i}`}>
      <div class="g-group-head">
        <h2 id={`group-${i}`}>{group.heading}</h2>
        <p class="mono">{group.guides.length} guides</p>
      </div>
      {#if group.layout === "list"}
        <ul class="g-verdicts">
          {#each group.guides as guide (guide.slug)}
            <li>
              <a href={guidePath(guide)}>
                <span class="g-verdict-name">PhoneMockup vs {guide.name}</span>
                <span class="g-verdict-text">{guide.verdict ?? guide.summary}</span>
                <span class="g-verdict-meta mono"
                  >{#if guide.comparison}Checked {guide.comparison
                      .checkedOn}{/if}</span
                >
                <ArrowUpRight size={22} aria-hidden="true" />
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <ul
          class="g-tiles"
          style:--cols={columns(group.guides.length)}
          style:--tile-ratio={group.guides.length <= 2 ? "16 / 10" : undefined}
        >
          {#each group.guides as guide (guide.slug)}
            {@const motion = motionsFor(guide.motions)[0]}
            <li class="g-tile">
              <div class="g-tile-media" style:background={background(motion)}>
                <MotionPreview
                  src={`/previews/${motion.preview}`}
                  poster={`/previews/${motion.poster}`}
                  label={`${guide.name}, ${motion.name}`}
                />
              </div>
              <a class="g-tile-title" href={guidePath(guide)}
                ><h3>{guide.name}</h3>
                <ArrowUpRight size={19} /></a
              >
              <p>{guide.summary}</p>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/each}

  <section class="g-final wrap" aria-labelledby="final-title">
    <h2 id="final-title">Let’s see it.</h2>
    <div class="g-final-actions">
      <a class="button primary" href="/platform/animation/soft-orbit"
        >Make a mockup <ArrowUpRight size={21} /></a
      >
      <span class="g-proof">Free during beta. No watermark. No account.</span>
    </div>
  </section>
</GuideShell>
