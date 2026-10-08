<script lang="ts">
    import ThreeScene from '$lib/components/mock-video/canvas/ThreeScene.svelte';
    import {cn} from "$lib/utils";
    import {project} from "$lib/stores/project.svelte";

    let {resizable = true, passive = false, sceneRef = $bindable(), class: className = ""} = $props();
    const width = $derived(Math.round(project.sceneResolution.x));
    const height = $derived(Math.round(project.sceneResolution.y));
</script>

<main class="w-full h-full" data-testid="canvas">
    <div
            class={cn("px-2 w-full h-full rounded-lg overflow-hidden min-h-0", className)}
    >
        <ThreeScene
                bind:this={sceneRef}
                {resizable}
                {passive}
                background={project.sceneSettings.backgroundColor}
                {width}
                {height}
        />
    </div>
</main>
