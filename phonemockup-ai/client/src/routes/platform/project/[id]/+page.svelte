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
      : data.damaged
        ? "Project couldn't be read — PhoneMockup.app"
        : "Project not found — PhoneMockup.app"}</title
  >
</svelte:head>

{#snippet unopenable(title: string, text: string)}
  <LibraryShell active="projects">
    <div class="library-heading">
      <div>
        <p class="library-eyebrow">Your workspace</p>
        <h1>{title}</h1>
        <p class="library-subtitle">{text}</p>
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
{/snippet}

{#if data.project}
  {#key data.project.id}
    <svelte:boundary
      onerror={(error) => console.error("Couldn't open the project", error)}
    >
      <MockVideo prepare={() => openSavedProject(data.project!)} />
      {#snippet failed()}
        {@render unopenable(
          "This project couldn't be opened.",
          "Its saved data is in this browser, but something in it isn't what the studio expects.",
        )}
      {/snippet}
    </svelte:boundary>
  {/key}
{:else if data.damaged}
  {@render unopenable(
    "This project couldn't be read.",
    "It is saved in this browser, but the saved data is damaged, so the studio can't open it.",
  )}
{:else}
  {@render unopenable(
    "Project not found.",
    "Projects are saved in the browser they were made in. This one isn't in this browser's storage, or it was deleted.",
  )}
{/if}
