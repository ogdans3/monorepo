<script lang="ts">
  import '../app.css';
  import { library } from '$lib/library.svelte';

  let { children } = $props();

  /**
   * The browser's index of lists, read once for whatever page is on screen.
   * Here rather than in each page, so nothing touches storage at import time
   * and the header can know whether there is anything to link to.
   */
  $effect(() => library.load());
</script>

{@render children()}
