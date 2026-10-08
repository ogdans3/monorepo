<script lang="ts">
  import ChannelMark from './ChannelMark.svelte';
  export let value: string[] = [];
</script>

<span class="channel-labels"
  >{#each value as id}<span class="channel-badge"><ChannelMark {id} /></span>{/each}</span
>
