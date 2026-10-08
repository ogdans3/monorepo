<script lang="ts">
    import MockVideo from "$lib/components/mock-video/MockVideo.svelte";
    import {startNewProject} from "$lib/stores/session.svelte";

    let {data} = $props();
</script>

<!-- Every visit starts a new project from this animation; keying on the id
     remounts the editor when only the id in the URL changes. -->
{#key data.animationGroup.id}
    <MockVideo animationGroup={data.animationGroup} prepare={() => startNewProject(data.animationGroup)}/>
{/key}
