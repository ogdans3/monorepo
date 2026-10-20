<script lang="ts">
  import { segments } from "$lib/guides/guides";

  let { text }: { text: string } = $props();
</script>

<p>
  {#each segments(text) as part}{#if "href" in part}<a
        class="prose-link"
        href={part.href}>{part.text}</a
      >{:else}{part.text}{/if}{/each}
</p>
