<script lang="ts">
    import SingleVideoExport from "./SingleVideoExport.svelte";
    import SingleImageExport from "./SingleImageExport.svelte";
    import BulkExport from "./BulkExport.svelte";
    import {project} from "$lib/stores/project.svelte";

    export let downloadAsImage = false;
    export let onFinished;
    export let autoClose;

    // One file is just the screen; only a list of them is a bulk export.
    const isBulk = project.isBulk;
</script>

{#if isBulk}
    <BulkExport {downloadAsImage} {onFinished} {autoClose}/>
{:else if downloadAsImage}
    <SingleImageExport {onFinished} {autoClose}/>
{:else}
    <SingleVideoExport {onFinished} {autoClose}/>
{/if}