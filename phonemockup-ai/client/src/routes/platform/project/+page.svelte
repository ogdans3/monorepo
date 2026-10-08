<script lang="ts">
    import {onMount} from "svelte";
    import {goto} from "$app/navigation";
    import {Spinner} from "$lib/components/ui/spinner";
    import {Button} from "$lib/components/ui/button";
    import Logo from "$lib/components/Logo.svelte";
    import {
        listProjectsFromLocalStorage,
        deleteProjectFromLocalStorage,
    } from "$lib/repo/localstorage.svelte";
    import {deleteProjectMedia} from "$lib/repo/media-store";
    import {Cloud, FolderOpen, Trash2, Plus} from "@lucide/svelte";
    import type {Project} from "$lib/components/mock-video/Project";

    let loading = $state(true);
    let error = $state<string | null>(null);
    let cloudProjects = $state<Array<{ key: string; project: Project }>>([]);
    let localProjects = $state<Array<{ key: string; project: Project }>>([]);

    onMount(async () => {
        try {
            loading = true;
            error = null;
            localProjects = listLocalProjects();
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load projects";
        } finally {
            loading = false;
        }
    });

    async function openProject(project: Project) {
        await goto(`/platform/project/${project.id}`);
    }

    function createNewProject() {
        goto("/platform/animation");
    }

    /** Entries that failed to parse have no project; they aren't listed. */
    function listLocalProjects() {
        return listProjectsFromLocalStorage().filter((entry) => entry.project);
    }

    function deleteLocalProject(key: string, project: Project) {
        if (confirm("Delete this project? This cannot be undone.")) {
            deleteProjectFromLocalStorage(key);
            deleteProjectMedia(project.id).catch((e) => console.warn("Couldn't delete project media", e));
            localProjects = listLocalProjects();
        }
    }

    let allProjects = $derived.by(() => {
        const cloud = cloudProjects.map(p => ({...p, isLocal: false}));
        const local = localProjects.map(p => ({...p, isLocal: true}));
        return [...cloud, ...local].sort((a, b) =>
            (a.project.name ?? "").localeCompare(b.project.name ?? "")
        );
    });
</script>

<svelte:head>
    <title>My projects — PhoneMockup.app</title>
</svelte:head>

<!-- Top Bar -->
<div class="bg-sidebar text-sidebar-foreground h-16 border-b border-surface-800 bg-surface-900 flex items-center justify-between px-4 shrink-0">
    <div class="flex items-center">
        <a href="/">
            <Logo/>
        </a>
    </div>
    <div class="flex items-center gap-2">
        <!-- Right side actions can be added here -->
    </div>
</div>

<div class="min-h-dvh bg-surface-950 text-surface-50 p-6 md:p-10">
    <div class="mx-auto max-w-7xl">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
            <div>
                <h1 class="text-3xl md:text-4xl font-bold">My Projects</h1>
                <p class="text-muted-foreground mt-2 text-sm md:text-base">
                    {allProjects.length} project{allProjects.length === 1 ? '' : 's'}
                </p>
            </div>
        </div>

        <!-- Error State -->
        {#if error}
            <div class="rounded-xl border border-destructive/30 bg-destructive/10 p-6 mb-6">
                <p class="text-destructive font-medium">{error}</p>
                <Button
                        onclick={() => window.location.reload()}
                        variant="outline"
                        class="mt-4"
                >
                    Retry
                </Button>
            </div>
        {/if}

        <!-- Loading State -->
        {#if loading}
            <div class="grid h-[60vh] place-items-center">
                <div class="flex flex-col items-center gap-4">
                    <Spinner class="w-8 h-8"/>
                    <p class="text-muted-foreground animate-pulse">Loading projects...</p>
                </div>
            </div>
        {:else if allProjects.length === 0}
            <!-- Empty State -->
            <div class="grid h-[70vh] place-items-center">
                <div class="text-center max-w-md p-8 rounded-2xl bg-surface-900/50 border border-border">
                    <div class="text-7xl mb-6 opacity-70">🎬</div>
                    <h2 class="text-2xl font-semibold mb-3">No projects yet</h2>
                    <p class="text-muted-foreground mb-8 leading-relaxed">
                        Create your first animation project. Cloud projects are automatically synced.
                    </p>
                    <Button onclick={createNewProject} size="lg" class="gap-2">
                        <Plus class="w-5 h-5"/>
                        Create Project
                    </Button>
                </div>
            </div>
        {:else}
            <!-- Projects Grid -->
            <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <!-- New Project Card -->
                <button type="button"
                     onclick={createNewProject}
                     class="group rounded-xl border-2 border-dashed border-border bg-surface-900/50 p-6 hover:bg-surface-800/50 transition-all duration-300 hover:shadow-lg cursor-pointer flex flex-col items-center justify-center">
                    <Plus class="w-12 h-12 text-muted-foreground mb-4 group-hover:text-surface-50 transition-colors"/>
                    <h3 class="text-lg font-semibold text-muted-foreground group-hover:text-surface-50 transition-colors">
                        New Project</h3>
                </button>

                {#each allProjects as {project, key, isLocal} (key)}
                    <div class="group rounded-xl border border-border bg-surface-900 p-6 hover:bg-surface-800 transition-all duration-300 hover:shadow-lg">
                        <!-- Project Header -->
                        <div class="flex items-start justify-between mb-4">
                            <h3 class="font-semibold text-lg truncate flex-1 text-surface-50 group-hover:text-white transition-colors pr-2">
                                {project.name}
                            </h3>
                            <div class="flex items-center gap-2 shrink-0">
                                {#if project.savedOnServer}
                                    <span title="Saved to cloud"><Cloud class="w-4 h-4 text-primary"/></span>
                                {/if}
                                <span class="text-[11px] px-2.5 py-1 rounded-full bg-muted/20 text-muted-foreground font-medium uppercase tracking-wide">
                                    {isLocal ? 'Local' : 'Cloud'}
                                </span>
                            </div>
                        </div>

                        <!-- Project Stats -->
                        <div class="flex items-center gap-4 text-sm text-muted-foreground mb-5">
                            <div class="flex items-center gap-1.5">
                                <div class="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></div>
                                {project.tracks?.length || 0} track{project.tracks?.length === 1 ? '' : 's'}
                            </div>
                            {#if project.files?.length}
                                <div class="flex items-center gap-1.5">
                                    <div class="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></div>
                                    {project.files.length} file{project.files.length === 1 ? '' : 's'}
                                </div>
                            {/if}
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center justify-between pt-4 border-t border-border/50">
                            <div class="flex gap-2">
                                <Button
                                        variant="ghost"
                                        size="sm"
                                        onclick={() => deleteLocalProject(key, project)}
                                        class="gap-1.5 text-destructive hover:text-red-300 hover:bg-destructive/10 h-8 px-3"
                                        title="Delete local project"
                                >
                                    <Trash2 class="w-3.5 h-3.5"/>
                                    <span class="hidden sm:inline text-xs">Delete</span>
                                </Button>
                            </div>
                            <Button
                                    variant="default"
                                    size="sm"
                                    onclick={() => openProject(project)}
                                    class="gap-1.5 h-8 px-4"
                            >
                                <FolderOpen class="w-3.5 h-3.5"/>
                                <span class="text-xs font-medium">Open</span>
                            </Button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>