<script lang="ts">
  import MockVideo from "$lib/components/mock-video/MockVideo.svelte";
  import { openSavedProject } from "$lib/stores/session.svelte";
  import LibraryShell from "$lib/components/library/LibraryShell.svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title
    >{data.project
      ? `${data.project.name} — PhoneMockup.app`
      : "Project not found — PhoneMockup.app"}</title
  >
</svelte:head>

{#if data.project}
  {#key data.project.id}
    <MockVideo prepare={() => openSavedProject(data.project!)} />
  {/key}
{:else}
  <LibraryShell active="projects">
    <div class="library-heading">
      <div>
        <p class="library-eyebrow">Your workspace</p>
        <h1>Project not found.</h1>
        <p class="library-subtitle">
          Projects are saved in the browser they were made in. This one isn't in
          this browser's storage, or it was deleted.
        </p>
        <div class="flex flex-wrap gap-3 mt-8">
          <a class="library-button primary" href="/platform/project"
            >My projects</a
          >
          <a class="library-button" href="/platform/animation"
            >Start a new one</a
          >
        </div>
      </div>
    </div>
  </LibraryShell>
{/if}
