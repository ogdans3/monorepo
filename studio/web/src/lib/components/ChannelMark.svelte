<script lang="ts">
  import { Ghost } from '@lucide/svelte';
  import { channels } from '$lib/channels';
  export let id: string;
  $: channel = channels.find((c) => c.id === id);
</script>

{#if channel}<span class="channel-mark" aria-hidden="true"
    >{#if id === 'snapchat'}<Ghost size={15} />{:else}{channel.mark}{/if}</span
  ><span>{channel.name}</span>{/if}
