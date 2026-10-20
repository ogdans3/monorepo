<script lang="ts">
  import { onMount } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { SlidersHorizontal, Maximize2 } from "@lucide/svelte";
  import "./studio.css";
  import { get } from "svelte/store";
  import TopBar from "$lib/components/mock-video/topbar/Topbar.svelte";
  import Canvas from "$lib/components/mock-video/canvas/Canvas.svelte";
  import Timeline from "$lib/components/mock-video/timeline/Timeline.svelte";
  import { selectedAnimationKeyframe } from "$lib/stores/animation.svelte";
  import { videoController } from "../../stores/video.svelte";
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
  } from "$lib/components/ui/dialog";

  import VideoRecorder from "$lib/components/mock-video/recording/VideoRecorder.svelte";
  import animationGroups from "$lib/animations/animations.svelte";
  import type { AnimationGroup } from "$lib/components/mock-video/Animation";
  import DropzoneOverlay from "$lib/components/mock-video/DropzoneOverlay.svelte";
  import { project } from "$lib/stores/project.svelte";
  import Sidebar from "$lib/components/mock-video/sidebar/Sidebar.svelte";
  import { toast } from "svelte-sonner";

  let {
    animationGroup = undefined,
    prepare = undefined,
  }: {
    animationGroup?: AnimationGroup;
    /** Runs before the editor's parts mount, to set up the project they show. */
    prepare?: () => void;
  } = $props();
  prepare?.();
  let sceneRef: any = $state();
  let open = $state(false);
  let timeline: Timeline | null;
  let recorderResolve: (() => void) | null = null;
  let autoClose: boolean = $state(false);
  let downloadAsImage: boolean = $state(false);

  let activePanel = $state("transform");
  let inspectorOpen = $state(false);
  const compact = new MediaQuery("(max-width: 900px)");
  let inspectorTrigger = $state<HTMLButtonElement>();
  let exportTrigger: HTMLElement | null = null;
  const width = $derived(Math.round(project.sceneResolution.x));
  const height = $derived(Math.round(project.sceneResolution.y));

  $effect(() => {
    if ($selectedAnimationKeyframe) activePanel = "transform";
  });

  function downloadImage() {
    downloadAsImage = true;
    openRecorder();
  }

  function downloadVideo() {
    downloadAsImage = false;
    openRecorder();
  }

  function openRecorder() {
    // The export drives the playhead frame by frame; playback would fight it.
    get(videoController).pause();
    exportTrigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    open = true;
    inspectorOpen = false;
  }

  function handleFinished() {
    open = false;
    recorderResolve?.();
    recorderResolve = null;
  }

  function openRecorderAndWaitForFinish(): Promise<void> {
    openRecorder();
    return new Promise<void>((resolve) => {
      recorderResolve = resolve;
    });
  }

  function isTextEntry(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    if (el.tagName !== "INPUT") return false;
    const type = (el as HTMLInputElement).type;
    return ![
      "button",
      "checkbox",
      "radio",
      "range",
      "color",
      "file",
      "submit",
      "reset",
    ].includes(type);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.code !== "Space") return;
    // Typing a space, or anything behind an open dialog, isn't a play/pause.
    if (isTextEntry(e.target)) return;
    // Space activates the focused control; only the workspace uses it as transport.
    if (
      (e.target as HTMLElement | null)?.closest(
        'button, a[href], input, [role="combobox"], [role="switch"], [role="checkbox"]',
      )
    )
      return;
    if (
      document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      )
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    get(videoController).toggle();
  }

  function sleep(ms: number) {
    return new Promise((fulfill, reject) => {
      setTimeout(fulfill, ms);
    });
  }

  async function createMp4ForAnimations() {
    if (!timeline) return;
    autoClose = true;
    let storedProjectName = project.name;
    for (let animationGroup of animationGroups) {
      project.name = animationGroup.name;
      timeline.clear();
      await sleep(50);
      await timeline.chooseAnimation(animationGroup, project.tracks[0].id);
      await sleep(50);
      get(videoController).startTime.set(0);
      get(videoController).setEndTime(
        animationGroup.animations[animationGroup.animations.length - 1].end +
          0.3,
      );
      await sleep(50);
      await openRecorderAndWaitForFinish();
      await sleep(300);
    }
    project.name = storedProjectName;
    autoClose = false;
  }

  function handleOpenExportPanel(event: MouseEvent) {
    activePanel = "export";
    inspectorTrigger = event.currentTarget as HTMLButtonElement;
    inspectorOpen = compact.current;
  }

  onMount(() => {
    const hadDark = document.body.classList.contains("dark");
    document.body.classList.remove("dark");
    document.body.classList.add("studio-theme");
    window.addEventListener("keydown", handleKeydown);
    if (project.settings.autoplay) {
      get(videoController).play();
    }
    const unsubscribeMediaError = get(videoController).mediaError.subscribe(
      (message) => {
        if (message) toast.error(message);
      },
    );
    return () => {
      document.body.classList.remove("studio-theme");
      if (hadDark) document.body.classList.add("dark");
      window.removeEventListener("keydown", handleKeydown);
      unsubscribeMediaError();
      get(videoController).pause();
    };
  });
</script>

<svelte:head
  ><title>{project.name || "Untitled project"} — PhoneMockup Studio</title
  ><meta name="robots" content="noindex" /></svelte:head
>

<div class="studio-shell studio-theme">
  <TopBar onOpenExportPanel={handleOpenExportPanel} />
  <div class="studio-body">
    {#if !compact.current}
      <aside class="studio-inspector" aria-label="Scene inspector">
        <Sidebar
          bind:activePanel
          onDownloadImage={downloadImage}
          onDownloadVideo={downloadVideo}
        />
      </aside>
    {/if}
    <div class="studio-workspace">
      <div class="studio-canvas-toolbar">
        <div class="studio-view-label">
          <span class="studio-status-dot"></span> Live preview
          <span class="studio-device-name">/ {project.model.name}</span>
        </div>
        <div class="studio-canvas-actions">
          <span class="studio-resolution">{width} × {height}</span>
          {#if compact.current}
            <button
              class="studio-button studio-edit-button"
              bind:this={inspectorTrigger}
              onclick={() => (inspectorOpen = true)}
              aria-haspopup="dialog"
              aria-expanded={inspectorOpen}
            >
              <SlidersHorizontal size={16} /> Edit scene
            </button>
          {:else}
            <span class="studio-fit"><Maximize2 size={13} /> Fit</span>
          {/if}
        </div>
      </div>
      <div class="studio-stage"><Canvas bind:sceneRef /></div>
      <div class="studio-canvas-hint">
        <span
          >Drag to rotate <span class="hint-divider">·</span> Right-drag to move</span
        ><span>Preview only · Export at full resolution</span>
      </div>
      <Timeline
        bind:this={timeline}
        {createMp4ForAnimations}
        {animationGroup}
      />
    </div>
  </div>
</div>

{#if compact.current}
  <Dialog bind:open={inspectorOpen}>
    <DialogContent
      class="studio-inspector-dialog"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (!open) inspectorTrigger?.focus();
      }}
    >
      <DialogHeader class="studio-drawer-heading">
        <DialogTitle>Scene inspector</DialogTitle>
        <DialogDescription
          >Customize your screen, device and scene.</DialogDescription
        >
      </DialogHeader>
      <Sidebar
        bind:activePanel
        onDownloadImage={downloadImage}
        onDownloadVideo={downloadVideo}
      />
    </DialogContent>
  </Dialog>
{/if}

<DropzoneOverlay />

<Dialog
  {open}
  onOpenChange={(value) => {
    if (!value) handleFinished();
  }}
>
  <DialogContent
    class="studio-export-dialog w-[95vw] h-[95vh]
      max-w-none max-h-none p-0 overflow-hidden
      rounded-xl bg-background flex flex-col
      sm:max-w-none gap-0 duration-0
    "
    interactOutsideBehavior="ignore"
    onCloseAutoFocus={(event) => {
      event.preventDefault();
      if (exportTrigger?.isConnected && exportTrigger !== document.body)
        exportTrigger.focus();
      else
        (
          document.querySelector("[data-export-trigger]") as HTMLElement | null
        )?.focus();
    }}
  >
    <DialogHeader class="px-4 py-3 border-b">
      <DialogTitle class="text-base font-semibold leading-6">
        {downloadAsImage ? "Export image" : "Export video"}
      </DialogTitle>
      <DialogDescription class="text-xs text-muted-foreground mt-0.5">
        {downloadAsImage
          ? "Render the current frame as an image."
          : "Render and encode your animation."}
        Your project stays open after exporting.
      </DialogDescription>
    </DialogHeader>

    <!-- Body fills remaining space -->
    <div class="min-h-0 h-full p-4">
      <VideoRecorder
        onFinished={handleFinished}
        {autoClose}
        {downloadAsImage}
      />
    </div>
  </DialogContent>
</Dialog>
