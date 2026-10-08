<script lang="ts">
    import MockVideo from "$lib/components/mock-video/MockVideo.svelte";
    import {Button} from "$lib/components/ui/button";
    import {openSavedProject} from "$lib/stores/session.svelte";

    let {data} = $props();
</script>

<svelte:head>
    <title>{data.project ? `${data.project.name} — PhoneMockup.app` : "Project not found — PhoneMockup.app"}</title>
</svelte:head>

{#if data.project}
    {#key data.project.id}
        <MockVideo prepare={() => openSavedProject(data.project!)}/>
    {/key}
{:else}
    <div class="grid min-h-dvh place-items-center bg-surface-950 px-6 text-surface-50">
        <div class="max-w-md text-center">
            <h1 class="mb-3 text-2xl font-semibold">Project not found</h1>
            <p class="mb-8 leading-relaxed text-muted-foreground">
                Projects are saved in the browser they were made in. This one isn't in this
                browser's storage, or it was deleted.
            </p>
            <div class="flex justify-center gap-3">
                <a href="/platform/project"><Button variant="secondary">My projects</Button></a>
                <a href="/platform/animation"><Button>Start a new one</Button></a>
            </div>
        </div>
    </div>
{/if}
