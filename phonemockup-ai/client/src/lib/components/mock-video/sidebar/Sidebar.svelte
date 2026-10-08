<script lang="ts">
    import * as Sidebar from "$lib/components/ui/sidebar";
    import * as Collapsible from "$lib/components/ui/collapsible";
    import {Spinner} from "$lib/components/ui/spinner/index.js";
    import {Separator} from "$lib/components/ui/separator";
    import {
        SlidersHorizontal,
        Clapperboard,
        Smartphone,
        CircleQuestionMark,
        Share2,
        ChevronDown,
        Boxes,
        Check,
        TriangleAlert, Folder,
    } from "@lucide/svelte";
    import TransformControls from "./TransformControls.svelte";
    import SceneSettings from "./SceneSettings.svelte";
    import ModelPanel from "$lib/components/mock-video/sidebar/ModelPanel.svelte";
    import ExportPanel from "$lib/components/mock-video/sidebar/ExportPanel.svelte";
    import {Button} from "$lib/components/ui/button";
    import {tick, type Snippet} from "svelte";
    import BulkUpload from "$lib/components/mock-video/sidebar/BulkUpload.svelte";
    import {project} from "$lib/stores/project.svelte";
    import {unfocusElement} from "$lib/components/mock-video/unfocus";
    import {
        Dialog,
        DialogClose,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle
    } from "$lib/components/ui/dialog";
    import ProjectPanel from "$lib/components/mock-video/sidebar/ProjectPanel.svelte";

    let {onDownloadImage, onDownloadVideo} = $props();

    let transformOpen = $state(true);
    let sceneOpen = $state(false);
    let modelOpen = $state(false);
    let bulkUploadOpen = $state(false);
    let howtoOpen = $state(false);
    let exportOpen = $state(false);
    let projectOpen = $state(false);
    let savingProject = $state(false);
    let exportAnimate = $state(false);

    let proDialogOpen = $state(false);
    let savingDialogOpen = $state(false);
    let projectSaveError = $state<any>(null);

    async function closeAllPanels() {
        transformOpen = false;
        sceneOpen = false;
        modelOpen = false;
        howtoOpen = false;
        exportOpen = false;
        projectOpen = false;
        bulkUploadOpen = false;
        await tick();
    }

    // Export this function so parent can call it
    export async function openOnlyExport() {
        unfocusElement();
        await closeAllPanels();
        exportOpen = true;
        exportAnimate = false;
        await tick();
        exportAnimate = true;
    }

    let name = $state(project.name);

    $effect(() => {
        if (project.name !== name) {
            name = project.name;
        }
    });
</script>

{#snippet group(icon: any, label: string, content: Snippet, open: boolean, onOpenChange: (open: boolean) => void, proFeature = false, highlight = false)}
    <Collapsible.Root
            open={open}
            onOpenChange={(open) => {
            onOpenChange(open);
            unfocusElement();
        }}
            class="group/collapsible"
    >
        <Sidebar.Group class="px-2 {highlight && exportAnimate ? 'export-anim' : ''}">
            <Sidebar.GroupLabel>
                <Collapsible.Trigger
                        class="group/trigger flex w-full items-center gap-2 rounded-md px-2.5 py-2
                    cursor-pointer transition-colors hover:bg-muted/60
                    data-[state=open]:bg-muted focus-visible:outline-none
                    focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {@const Component = icon}
                    <Component
                            class="h-4 w-4 text-muted-foreground transition-colors
                        group-hover/trigger:text-foreground
                        data-[state=open]:text-foreground"
                    />
                    <span class="text-sm font-medium flex items-center gap-2">
                        {label}
                        {#if proFeature}
                            <span
                                    class="inline-flex items-center rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600
                                px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow
                                ring-1 ring-black/10"
                                    aria-label="Pro feature"
                                    title="Available on Pro plans"
                            >
                                Pro
                            </span>
                        {/if}
                    </span>
                    <ChevronDown
                            class="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-all
                        opacity-70 group-hover/trigger:opacity-100
                        group-data-[state=open]/collapsible:rotate-180
                        group-data-[state=open]/collapsible:text-foreground"
                            aria-hidden="true"
                    />
                </Collapsible.Trigger>
            </Sidebar.GroupLabel>
            <Collapsible.Content>
                <Sidebar.GroupContent class="px-2.5 pt-2 pb-3">
                    {@render content()}
                    <Separator/>
                </Sidebar.GroupContent>
            </Collapsible.Content>
        </Sidebar.Group>
    </Collapsible.Root>
{/snippet}

{#snippet transformContent()}
    <TransformControls/>
{/snippet}

{#snippet sceneContent()}
    <SceneSettings/>
{/snippet}

{#snippet modelContent()}
    <ModelPanel/>
{/snippet}

{#snippet bulkUpload()}
    <BulkUpload/>
{/snippet}

{#snippet howtoContent()}
    <div class="m-4 text-sm">Coming soon</div>
{/snippet}

{#snippet exportContent()}
    <ExportPanel {onDownloadImage} {onDownloadVideo}/>
{/snippet}

{#snippet projectContent()}
    <ProjectPanel/>
{/snippet}

<Sidebar.Root class="h-full border-b-0 overflow-hidden border" data-testid="sidebar">
    <Sidebar.Content class="py-1 border-b-0 mb-4">
        {@render group(SlidersHorizontal, "Transform", transformContent, transformOpen, (v: boolean) => (transformOpen = v))}
        {@render group(Clapperboard, "Scene", sceneContent, sceneOpen, (v: boolean) => (sceneOpen = v))}
        {@render group(Smartphone, "Model", modelContent, modelOpen, (v: boolean) => (modelOpen = v))}
        {@render group(Boxes, "Bulk upload", bulkUpload, bulkUploadOpen, (v: boolean) => (bulkUploadOpen = v), true)}
        {@render group(CircleQuestionMark, "How‑to", howtoContent, howtoOpen, (v: boolean) => (howtoOpen = v))}
        {@render group(Share2, "Export / Share", exportContent, exportOpen, (v: boolean) => (exportOpen = v), false, true)}
        {@render group(Folder, "Project Settings", projectContent, projectOpen, (v: boolean) => (projectOpen = v), false, false)}
    </Sidebar.Content>
</Sidebar.Root>

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
                    Saving to localStorage...
                {:else if projectSaveError}
                    Error: {projectSaveError.message || 'Unknown error occurred'}
                {:else}
                    Project saved to localStorage.
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

<style>
    :global(.export-anim) {
        animation: export-blink 300ms ease-in-out forwards;
    }

    @keyframes export-blink {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0.3;
        }
        100% {
            opacity: 1;
        }
    }
</style>
