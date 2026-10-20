<script lang="ts">
  // Stores and utilities
  import { project } from "$lib/stores/project.svelte";
  import { saveProjectToLocalStorage } from "$lib/repo/localstorage.svelte";
  import { saveProjectMedia } from "$lib/repo/media-store";
  import {
    unreadMediaFor,
    whenMediaRestored,
  } from "$lib/stores/session.svelte";
  import { videoController } from "$lib/stores/video.svelte";
  import { goto, replaceState } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { onDestroy } from "svelte";
  import { captureProjectThumbnail } from "$lib/repo/project-thumbnail";

  // UI components
  import { Button } from "$lib/components/ui/button";
  import { Spinner } from "$lib/components/ui/spinner/index.js";

  // Dialog components
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "$lib/components/ui/dialog";

  // Icons
  import {
    Check,
    TriangleAlert,
    ArrowUpRight,
    FolderOpen,
    Save,
  } from "@lucide/svelte";
  import { get } from "svelte/store";
  import AuthControls from "$lib/components/auth/AuthControls.svelte";

  // Props
  let { onOpenExportPanel } = $props();

  // State
  let savingProject = $state(false);
  let savingDialogOpen = $state(false);
  let projectSaveError = $state<any>(null);
  let justSaved = $state(false);
  let savedReset: ReturnType<typeof setTimeout>;
  onDestroy(() => clearTimeout(savedReset));

  // Functions
  async function saveClicked() {
    projectSaveError = null;
    savingProject = true;
    justSaved = false;
    try {
      // A project opened a moment ago may still be reading its screen back.
      await whenMediaRestored();
      const screen = get(get(videoController).currentFile);
      const bulk = project.files
        .map((f) => f.fileBlob)
        .filter((f) => f instanceof File);
      // The sample is standing in for media that couldn't be read: leave
      // the stored file alone until the user puts something else on screen.
      const kept =
        !screen && bulk.length === 0 ? unreadMediaFor(project.id) : null;
      const saved = {
        ...project.toProject(),
        thumbnail: captureProjectThumbnail(),
        screenMedia: screen
          ? { fileName: screen.name, fileType: screen.type }
          : (kept?.screenMedia ?? null),
      };
      try {
        saveProjectToLocalStorage(saved);
      } catch (error) {
        // A preview is expendable if browser storage is nearly full.
        if (!saved.thumbnail) throw error;
        delete saved.thumbnail;
        saveProjectToLocalStorage(saved);
      }

      // The JSON is safe at this point; the media is a separate store
      // with its own quota, so a failure there shouldn't undo the save.
      let mediaSaved = true;
      try {
        if (!kept) await saveProjectMedia(saved.id, { screen, bulk });
      } catch (e) {
        mediaSaved = false;
        console.error("Failed to store project media", e);
      }

      replaceState(`/platform/project/${saved.id}`, { reason: "save" });
      if (mediaSaved) {
        toast.success("Project saved");
        justSaved = true;
      } else {
        toast.warning(
          "Project saved, but its screen image or video couldn't be stored in this browser.",
        );
      }

      savingDialogOpen = false;
      clearTimeout(savedReset);
      savedReset = setTimeout(() => {
        justSaved = false;
      }, 2400);
    } catch (e) {
      projectSaveError = e;
      savingDialogOpen = true;
      console.error(e);
    } finally {
      savingProject = false;
    }
  }

  async function goToMyProjects() {
    await goto("/platform/project");
  }
</script>

<header class="studio-topbar">
  <a class="studio-wordmark" href="/" aria-label="PhoneMockup home"
    ><span></span><span class="studio-brand-name">phonemockup</span><span
      class="studio-mobile-brand">pm<span>.</span></span
    ><span class="studio-wordmark-suffix"> / studio</span></a
  >
  <div class="studio-project-title">
    <span class="studio-project-divider">/</span><span
      >{project.name || "Untitled project"}</span
    >
  </div>
  <div class="studio-topbar-actions">
    <AuthControls compact />
    <Button
      variant="ghost"
      class="studio-projects-button"
      aria-label="My Projects"
      onclick={goToMyProjects}
      ><FolderOpen size={16} /><span>My Projects</span></Button
    >
    <span class="studio-topbar-divider"></span>
    <Button
      variant="outline"
      onclick={saveClicked}
      aria-label="Save"
      disabled={savingProject}
    >
      {#if savingProject}<Spinner class="h-4 w-4" />{:else if justSaved}<Check
          size={15}
        />{:else}<Save size={15} />{/if}<span
        >{savingProject ? "Saving…" : justSaved ? "Saved" : "Save"}</span
      >
    </Button>
    <Button
      onclick={onOpenExportPanel}
      class="studio-export-button"
      data-export-trigger
      >{project.isBulk ? "Bulk Export" : "Export"}<ArrowUpRight
        size={16}
      /></Button
    >
  </div>
</header>

<!-- Dialogs -->
<Dialog open={savingDialogOpen} onOpenChange={(o) => (savingDialogOpen = o)}>
  <DialogContent class="app-dialog max-w-md">
    <DialogHeader>
      <DialogTitle class="flex items-center gap-2">
        {#if savingProject}
          <Spinner class="h-4 w-4" />
          Saving project…
        {:else if projectSaveError}
          <TriangleAlert class="h-5 w-5 text-red-600" />
          Couldn't save this project
        {:else}
          <Check class="h-5 w-5 text-emerald-600" />
          Project saved
        {/if}
      </DialogTitle>
      <DialogDescription>
        {#if savingProject}
          Saving in this browser…
        {:else if projectSaveError}
          Your work is still open. This browser couldn't save it. Free up some
          browser storage and try again.
        {:else}
          Project saved in this browser.
        {/if}
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button
        variant="outline"
        disabled={savingProject}
        onclick={() => (savingDialogOpen = false)}
      >
        Close
      </Button>
      <Button disabled={savingProject} onclick={saveClicked}
        >Try saving again</Button
      >
    </DialogFooter>
  </DialogContent>
</Dialog>
