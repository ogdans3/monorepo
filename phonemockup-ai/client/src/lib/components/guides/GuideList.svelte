<script lang="ts">
  import { ArrowUpRight } from "@lucide/svelte";
  import { guidePath, hubFor, type Guide } from "$lib/guides/guides";
  import { background, deviceOf, motionsFor } from "$lib/guides/motions";

  let {
    guides,
    showSection = false,
  }: { guides: Guide[]; showSection?: boolean } = $props();
</script>

<ul class="g-list">
  {#each guides as guide (guidePath(guide))}
    {@const motion = motionsFor(guide.motions)[0]}
    <li>
      <a href={guidePath(guide)}>
        <span class="g-thumb" style:background={background(motion)}
          ><img
            src={`/previews/${motion.poster}`}
            alt=""
            width="80"
            height="100"
            loading="lazy"
            decoding="async"
          /></span
        >
        <span>
          <span class="g-list-name">{guide.name}</span>
          <span class="g-list-summary">{guide.summary}</span>
          <span class="g-list-meta"
            >{[
              showSection ? hubFor(guide.section).name : "",
              deviceOf(motion),
              motion.name,
            ]
              .filter(Boolean)
              .join(" · ")}</span
          >
        </span>
        <ArrowUpRight size={20} aria-hidden="true" />
      </a>
    </li>
  {/each}
</ul>
