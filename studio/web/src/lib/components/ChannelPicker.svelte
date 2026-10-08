<script lang="ts">
  import { channels } from '$lib/channels';
  import ChannelMark from './ChannelMark.svelte';
  import { Check } from '@lucide/svelte';
  export let value: string[] = [];
  export let label: string;
  export let disabled = false;
  export let onchange: (value: string[]) => void;
</script>

<fieldset class="channel-picker" {disabled}>
  <legend>{label}</legend>
  <div>
    {#each channels as c}<button
        type="button"
        class:chosen={value.includes(c.id)}
        aria-pressed={value.includes(c.id)}
        onclick={() =>
          onchange(value.includes(c.id) ? value.filter((id) => id !== c.id) : [...value, c.id])}
        ><ChannelMark id={c.id} />{#if value.includes(c.id)}<Check size={13} />{/if}</button
      >{/each}
  </div>
</fieldset>
