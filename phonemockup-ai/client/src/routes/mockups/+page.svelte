<script lang="ts">
  import GuideHub from "$lib/components/guides/GuideHub.svelte";

  let { data } = $props();
</script>

<GuideHub hub={data.hub} />
