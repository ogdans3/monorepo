<script lang="ts">
  import GuidePage from "$lib/components/guides/GuidePage.svelte";

  let { data } = $props();
</script>

<GuidePage guide={data.guide} />
