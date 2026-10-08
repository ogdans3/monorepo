<script lang="ts">
    // Stores and utilities
    import {project} from "$lib/stores/project.svelte";
    import {saveProjectToLocalStorage} from "$lib/repo/localstorage.svelte";
    import {saveProjectMedia} from "$lib/repo/media-store";
    import {videoController} from "$lib/stores/video.svelte";
    import {goto, replaceState} from "$app/navigation";
    import {toast} from "svelte-sonner";

    // UI components
    import Logo from "$lib/components/Logo.svelte";
    import {Button} from "$lib/components/ui/button";
    import {Spinner} from "$lib/components/ui/spinner/index.js";

    // Dialog components
    import {
        Dialog,
        DialogClose,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle
    } from "$lib/components/ui/dialog";

    // Icons
    import {Check, TriangleAlert} from "@lucide/svelte";
    import {get} from "svelte/store";

    // Props
    let {onOpenExportPanel} = $props();

    // State
    let savingProject = $state(false);
    let savingDialogOpen = $state(false);
    let projectSaveError = $state<any>(null);

    // Functions
    async function saveClicked() {
        projectSaveError = null;
        savingProject = true;
        savingDialogOpen = true;
        try {
            const screen = get(get(videoController).currentFile);
            const saved = {
                ...project.toProject(),
                screenMedia: screen ? {fileName: screen.name, fileType: screen.type} : null
            };
            saveProjectToLocalStorage(saved);

            // The JSON is safe at this point; the media is a separate store
            // with its own quota, so a failure there shouldn't undo the save.
            let mediaSaved = true;
            try {
                await saveProjectMedia(saved.id, {
                    screen,
                    bulk: project.files.map((f) => f.fileBlob).filter((f) => f instanceof File)
                });
            } catch (e) {
                mediaSaved = false;
                console.error("Failed to store project media", e);
            }

            replaceState(`/platform/project/${saved.id}`, {reason: "save"});
            if (mediaSaved) {
                toast.success("Project saved");
            } else {
                toast.warning("Project saved, but its screen image or video couldn't be stored in this browser.");
            }

            setTimeout(() => {
                savingDialogOpen = false;
            }, 800);
        } catch (e) {
            projectSaveError = e;
            console.error(e);
            toast.error("Failed to save project");
        } finally {
            savingProject = false;
        }
    }

    async function goToMyProjects() {
        await goto("/platform/project");
    }
</script>

<div class="bg-sidebar text-sidebar-foreground h-16 border-b border-surface-800 bg-surface-900 flex items-center justify-between px-4 shrink-0">
    <!-- Logo -->
    <div class="flex items-center">
        <a href="/">
            <Logo/>
        </a>

        <Button size="sm" variant="link" onclick={goToMyProjects}>
            My Projects
        </Button>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
        <Button size="sm" variant="ghost" onclick={onOpenExportPanel}>
            {#if project.isBulk}
                Bulk Export
            {:else}
                Export
            {/if}
        </Button>

        <Button size="sm" variant="ghost" onclick={saveClicked}>
            {#if savingProject}
                <Spinner class="h-4 w-4"/>
            {:else}
                Save
            {/if}
        </Button>
    </div>
</div>

<!-- Dialogs -->
<Dialog open={savingDialogOpen} onOpenChange={(o) => (savingDialogOpen = o)}>
    <DialogContent class="max-w-md" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
                {#if savingProject}
                    <Spinner class="h-4 w-4"/>
                    Saving project…
                {:else if projectSaveError}
                    <TriangleAlert class="h-5 w-5 text-red-600"/>
                    Save Failed
                {:else}
                    <Check class="h-5 w-5 text-emerald-600"/>
                    Saved Successfully
                {/if}
            </DialogTitle>
            <DialogDescription>
                {#if savingProject}
                    Saving in this browser…
                {:else if projectSaveError}
                    Error: {projectSaveError.message || 'Unknown error occurred'}
                {:else}
                    Project saved in this browser.
                {/if}
            </DialogDescription>
        </DialogHeader>
        <DialogFooter>
            <Button
                    disabled={savingProject}
                    onclick={() => (savingDialogOpen = false)}
            >
                Close
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>