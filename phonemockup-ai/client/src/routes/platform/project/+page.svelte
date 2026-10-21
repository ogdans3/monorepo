<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    ArrowUpRight,
    Plus,
    Search,
    Pencil,
    Trash2,
    HardDrive,
    Smartphone,
  } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import LibraryShell from "$lib/components/library/LibraryShell.svelte";
  import ConfirmDelete from "$lib/components/library/ConfirmDelete.svelte";
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import {
    listProjectsFromLocalStorage,
    getProjectFromLocalStorage,
    saveProjectToLocalStorage,
    deleteProjectFromLocalStorage,
  } from "$lib/repo/localstorage.svelte";
  import { deleteProjectMedia } from "$lib/repo/media-store";
  type Entry = ReturnType<typeof listProjectsFromLocalStorage>[number];
  let loading = $state(true);
  let error = $state("");
  let unreadable = $state(0);
  let projects = $state<Entry[]>([]);
  let search = $state("");
  let searchInput = $state<HTMLInputElement>();
  let sort = $state("recent");
  let selected = $state<Entry | null>(null);
  let deleting = $state(false);
  let deleteOpen = $state(false);
  let renameOpen = $state(false);
  let name = $state("");
  let actionError = $state("");
  let actionTrigger = $state<HTMLElement>();
  let renameInput = $state<HTMLInputElement>();
  function loadProjects() {
    try {
      error = "";
      const entries = listProjectsFromLocalStorage();
      unreadable = entries.filter((e) => !e.project).length;
      projects = entries.filter((e) => e.project);
    } catch {
      error =
        "This browser couldn't open your saved projects. Try again or check that browser storage is available.";
    } finally {
      loading = false;
    }
  }
  onMount(() => {
    loadProjects();
    const sync = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("project:local:")) loadProjects();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  });
  const filtered = $derived(
    projects
      .filter((e) =>
        `${e.project.name} ${e.project.model?.name ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
      .sort((a, b) =>
        sort === "name"
          ? (a.project.name ?? "").localeCompare(b.project.name ?? "")
          : (Date.parse(b.metadata?.savedAt) || 0) -
            (Date.parse(a.metadata?.savedAt) || 0),
      ),
  );
  function savedDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Saved in this browser"
      : `Saved ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date)}`;
  }
  function thumbnail(entry: Entry) {
    const value = entry.project.thumbnail;
    return value && /^data:image\/(webp|png|jpeg);base64,/.test(value)
      ? value
      : null;
  }
  function startAction(
    entry: Entry,
    event: MouseEvent,
    action: "rename" | "delete",
  ) {
    selected = entry;
    actionTrigger = event.currentTarget as HTMLElement;
    actionError = "";
    name = entry.project.name;
    if (action === "rename") renameOpen = true;
    else deleteOpen = true;
  }
  function renameProject(event: SubmitEvent) {
    event.preventDefault();
    if (!selected || !name.trim()) return;
    try {
      // Rename what is stored now; another tab may have saved since the
      // list was read, and the copy here would put its old edits back.
      const current = getProjectFromLocalStorage(selected.key);
      if (!current) {
        renameOpen = false;
        loadProjects();
        toast.warning("That project is no longer saved in this browser.");
        return;
      }
      saveProjectToLocalStorage({ ...current, name: name.trim() });
      loadProjects();
      renameOpen = false;
      toast.success("Project renamed");
    } catch {
      actionError =
        "We couldn't save the name. Your project is unchanged. Try again.";
    }
  }
  async function deleteProject() {
    if (!selected || deleting) return;
    deleting = true;
    actionError = "";
    try {
      if (!deleteProjectFromLocalStorage(selected.key))
        throw new Error("delete failed");
      let mediaRemoved = true;
      try {
        await deleteProjectMedia(selected.project.id);
      } catch {
        mediaRemoved = false;
      }
      loadProjects();
      // The deleted card's button is about to go: give focus to the first
      // remaining card, or to New project, instead of dropping it to <body>.
      await tick();
      actionTrigger =
        document.querySelector<HTMLElement>(".project-grid a") ??
        document.querySelector<HTMLElement>("[data-library-new-project]") ??
        undefined;
      deleteOpen = false;
      if (mediaRemoved) toast.success("Project deleted");
      else
        toast.warning(
          "Project deleted. This browser couldn't clean up its stored media.",
        );
    } catch {
      actionError = "We couldn't delete this project. Please try again.";
    } finally {
      deleting = false;
    }
  }
</script>

<svelte:head
  ><title>My projects — PhoneMockup</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<LibraryShell active="projects">
  <div class="library-heading">
    <div>
      <p class="library-eyebrow">Your workspace</p>
      <h1>My projects<span class="project-heading-dot">.</span></h1>
      <p class="library-subtitle">
        Pick up where you left off. Or try a new angle.
      </p>
    </div>
    <a
      class="library-button primary"
      data-library-new-project
      href="/platform/animation">New project <Plus size={18} /></a
    >
  </div>
  {#if error}<div class="library-notice" role="alert">
      <p>{error}</p>
      <button class="library-button" onclick={loadProjects}>Try again</button>
    </div>
  {:else if loading}<div
      class="project-skeletons"
      role="status"
      aria-label="Loading projects"
    >
      {#each [1, 2, 3] as n}<div></div>{/each}
    </div>
  {:else if !projects.length}
    <section class="library-empty">
      <div>
        <h2>A place for your next idea.</h2>
        <p>
          Start with a motion, add your screen and make it yours. Your saved
          work will live here.
        </p>
        <a class="library-button primary" href="/platform/animation"
          >Explore the motions <ArrowUpRight size={18} /></a
        >
      </div>
      <div class="library-empty-art" aria-hidden="true">
        <img src="/previews/motion-2026/soft-orbit.webp" alt="" /><img
          src="/previews/motion-2026/top-down.webp"
          alt=""
        />
      </div>
    </section>
  {:else}
    <div class="library-toolbar">
      <label class="library-search"
        ><Search size={17} aria-hidden="true" /><span class="sr-only"
          >Search projects</span
        ><input
          type="search"
          placeholder="Find a project or device"
          bind:value={search}
          bind:this={searchInput}
        /></label
      ><span class="library-count" role="status"
        >{filtered.length}
        {filtered.length === 1 ? "project" : "projects"}</span
      ><label class="library-sort"
        >Sort by<select bind:value={sort}
          ><option value="recent">Last saved</option><option value="name"
            >Name A–Z</option
          ></select
        ></label
      >
    </div>
    {#if !filtered.length}<div class="library-no-results">
        <h2>No projects found.</h2>
        <p>Try a different project name or device.</p>
        <button
          class="library-button"
          onclick={() => {
            search = "";
            searchInput?.focus();
          }}>Clear search</button
        >
      </div>
    {:else}<div class="project-grid">
        {#each filtered as entry (entry.key)}
          <article class="project-card" data-project-id={entry.project.id}>
            <a
              class="project-preview"
              href={`/platform/project/${encodeURIComponent(entry.project.id)}`}
              aria-label={`Open ${entry.project.name}`}
            >
              {#if thumbnail(entry)}<img
                  src={thumbnail(entry)!}
                  alt={`Preview of ${entry.project.name}`}
                  loading="lazy"
                />{:else}<div class="project-placeholder">
                  <Smartphone size={48} strokeWidth={1} /><span
                    >{entry.project.model?.name ?? "Device mockup"}</span
                  ><small>Save in the studio to add a preview</small>
                </div>{/if}
              <span class="project-duration"
                >{Number(entry.project.timeline?.endTime ?? 0).toFixed(
                  1,
                )}s</span
              ><span class="project-open" aria-hidden="true"
                ><ArrowUpRight size={18} /></span
              >
            </a>
            <div class="project-card-title">
              <a
                href={`/platform/project/${encodeURIComponent(entry.project.id)}`}
                title={entry.project.name}
                >{entry.project.name || "Untitled project"}</a
              >
              <div class="project-actions">
                <button
                  type="button"
                  aria-label={`Rename ${entry.project.name}`}
                  title="Rename project"
                  onclick={(e) => startAction(entry, e, "rename")}
                  ><Pencil size={15} /></button
                ><button
                  type="button"
                  aria-label={`Delete ${entry.project.name}`}
                  title="Delete project"
                  onclick={(e) => startAction(entry, e, "delete")}
                  ><Trash2 size={15} /></button
                >
              </div>
            </div>
            <p class="project-meta">
              {entry.project.model?.name ?? "Device mockup"}<span>·</span>{entry
                .project.tracks?.length ?? 0}
              {entry.project.tracks?.length === 1 ? "track" : "tracks"}
            </p>
            <p class="project-date">{savedDate(entry.metadata?.savedAt)}</p>
          </article>
        {/each}
      </div>{/if}
  {/if}
  {#if unreadable}<p class="library-notice" role="status">
      {unreadable} saved {unreadable === 1
        ? "project couldn't"
        : "projects couldn't"} be read. The original data is still in this browser.
    </p>{/if}
  <p class="library-storage-note">
    <HardDrive size={15} aria-hidden="true" /><span
      >Saved in this browser. Your projects and media stay on this device, even
      when you sign in.</span
    >
  </p>
</LibraryShell>
<ConfirmDelete
  bind:open={deleteOpen}
  title="Delete this project?"
  description={`“${selected?.project.name ?? "This project"}” and its saved screen media will be removed from this browser. This can't be undone.`}
  actionLabel="Delete project"
  busy={deleting}
  error={actionError}
  onconfirm={deleteProject}
  returnFocus={actionTrigger}
/>
<Dialog bind:open={renameOpen}>
  <DialogContent
    class="app-dialog"
    onOpenAutoFocus={(e) => {
      e.preventDefault();
      renameInput?.focus();
      renameInput?.select();
    }}
    onCloseAutoFocus={(e) => {
      e.preventDefault();
      actionTrigger?.focus();
    }}
  >
    <DialogHeader
      ><DialogTitle>Give it a name.</DialogTitle><DialogDescription
        >A useful name makes your next visit easier.</DialogDescription
      ></DialogHeader
    >
    <form onsubmit={renameProject} class="app-dialog-form">
      <label for="rename-project">Project name</label><input
        id="rename-project"
        bind:this={renameInput}
        bind:value={name}
        maxlength="120"
        required
        aria-describedby={actionError ? "rename-error" : undefined}
      />{#if actionError}<p
          id="rename-error"
          class="app-form-error"
          role="alert"
        >
          {actionError}
        </p>{/if}<DialogFooter
        ><Button
          type="button"
          variant="outline"
          onclick={() => (renameOpen = false)}>Cancel</Button
        ><Button type="submit" disabled={!name.trim()}>Save name</Button
        ></DialogFooter
      >
    </form>
  </DialogContent>
</Dialog>

<style>
  .project-heading-dot {
    color: #a3442c;
  }
  .project-grid,
  .project-skeletons {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 36px 24px;
  }
  .project-card {
    min-width: 0;
  }
  .project-preview {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 4/3;
    background: #eae9e2;
    border-radius: 5px;
    overflow: hidden;
  }
  .project-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .project-duration {
    position: absolute;
    top: 12px;
    left: 12px;
    background: #fffefaed;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    padding: 4px 8px;
    border-radius: 3px;
  }
  .project-open {
    display: grid;
    place-items: center;
    position: absolute;
    right: 12px;
    bottom: 12px;
    width: 36px;
    height: 36px;
    background: #fffefaed;
    border-radius: 50%;
    color: #a3442c;
  }
  .project-card-title {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 54px;
  }
  .project-card-title > a {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 18px;
    font-weight: 500;
    letter-spacing: -0.025em;
    padding-block: 10px;
  }
  .project-actions {
    display: flex;
    gap: 4px;
  }
  .project-actions button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 4px;
    color: #6d6d63;
  }
  .project-meta,
  .project-date {
    font-size: 12px;
    color: #6d6d63;
    line-height: 1.7;
  }
  .project-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .project-date {
    font-size: 11px;
    margin-top: 4px;
  }
  .project-placeholder {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    text-align: center;
    color: #5f5f58;
    padding: 24px;
  }
  .project-placeholder span {
    font-size: 13px;
  }
  .project-placeholder small {
    font-size: 11px;
  }
  .project-skeletons > div {
    aspect-ratio: 4/3;
    border-radius: 5px;
    background: #eeede7;
  }
  @media (hover: hover) and (pointer: fine) {
    .project-card-title a:hover {
      color: #a3442c;
    }
    .project-actions button:hover {
      background: #e9e5dc;
      color: #a3442c;
    }
    .project-preview:hover .project-open {
      background: #a3442c;
      color: #fffefa;
    }
  }
  @media (max-width: 1050px) {
    .project-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 600px) {
    .project-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 28px;
    }
    .project-skeletons {
      grid-template-columns: 1fr;
    }
  }
</style>
