<script lang="ts">
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { project } from "$lib/stores/project.svelte";
  import { videoController } from "$lib/stores/video.svelte";
  import {
    screenCutCues,
    createScreenSwitchVideo,
  } from "$lib/animations/screen-switch";
  import { Button } from "$lib/components/ui/button";
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
  } from "$lib/components/ui/dialog";

  // These three phone orientations have been checked with contrasting screens.
  const supportedModels = ["iphone-16-pro", "pixel-9-pro", "galaxy-s24-ultra"];
  const cues = $derived(
    supportedModels.includes(project.model.id) && project.tracks.length === 1
      ? screenCutCues(project.tracks)
      : [],
  );
  let chosen = $state("");
  const cue = $derived(cues.find((c) => c.id === chosen) ?? cues[0]);
  let open = $state(false);
  let before = $state<File>();
  let after = $state<File>();
  let busy = $state(false);
  let progress = $state(0);
  let error = $state("");
  let success = $state("");
  let abort: AbortController | undefined;
  onDestroy(() => abort?.abort());

  function snapshot() {
    return JSON.stringify({
      project: project.id,
      model: project.model.id,
      cue,
      duration: project.timeline.endTime,
    });
  }
  async function create(useDemo = false) {
    if (!cue || busy) return;
    const state = snapshot(),
      at = cue.at,
      duration = project.timeline.endTime;
    abort = new AbortController();
    busy = true;
    error = "";
    success = "";
    progress = 0;
    get(videoController).pause();
    try {
      let a = before,
        b = after;
      if (useDemo) {
        const files = await Promise.all(
          ["focus", "focus-complete"].map(async (id) => {
            const response = await fetch(`/media/studio/${id}.png`, {
              signal: abort?.signal,
            });
            if (!response.ok)
              throw new Error("Could not load the demo images.");
            return new File([await response.blob()], `${id}.png`, {
              type: "image/png",
            });
          }),
        );
        [a, b] = files;
      }
      if (!a || !b) throw new Error("Choose a before and an after image.");
      const file = await createScreenSwitchVideo(a, b, {
        at,
        duration,
        signal: abort.signal,
        onProgress: (p) => (progress = p),
      });
      if (abort.signal.aborted) return;
      if (snapshot() !== state)
        throw new Error(
          "The timeline changed. Create the screen switch again with the new timing.",
        );
      before = a;
      after = b;
      project.files = [];
      await get(videoController).setPlayheadPosition(0);
      await get(videoController).setMediaSource(file, false);
      project.markDirty();
      success = `Screen switch ready at ${at.toFixed(2)}s. Press Play to preview.`;
    } catch (e) {
      if (!abort.signal.aborted)
        error =
          e instanceof Error
            ? e.message
            : "Could not create the screen switch.";
    } finally {
      busy = false;
    }
  }
</script>

{#if cue}
  <div class="screen-switch-bar" data-testid="screen-switch-bar">
    <span>Hidden screen cut · {cue.at.toFixed(2)}s</span>
    <Button
      variant="outline"
      style="color: var(--foreground)"
      size="sm"
      onclick={() => {
        get(videoController).pause();
        get(videoController).setPlayheadPosition(cue.at);
      }}>Go to cut</Button
    >
    <Button
      variant="secondary"
      size="sm"
      onclick={() => {
        open = true;
        error = "";
        success = "";
      }}>Switch screens</Button
    >
  </div>
{/if}

<Dialog
  bind:open
  onOpenChange={(value) => {
    if (!busy) open = value;
  }}
>
  <DialogContent
    class="max-w-lg"
    interactOutsideBehavior={busy ? "ignore" : "close"}
    escapeKeydownBehavior={busy ? "ignore" : "close"}
  >
    <DialogHeader
      ><DialogTitle>Switch screens during the flip</DialogTitle
      ><DialogDescription
        >Choose two images. The screen changes while the phone faces away, at {cue?.at.toFixed(
          2,
        )}s.</DialogDescription
      ></DialogHeader
    >
    <div class="switch-form">
      {#if cues.length > 1}<label
          >Screen-change moment<select disabled={busy} bind:value={chosen}
            >{#each cues as item}<option value={item.id}
                >{item.at.toFixed(2)}s · {item.track}</option
              >{/each}</select
          ></label
        >{/if}
      <label
        >Before the flip<input
          disabled={busy}
          type="file"
          accept="image/*"
          aria-label="Before the flip"
          onchange={(e) => {
            before = e.currentTarget.files?.[0];
            success = "";
          }}
        />
        {#if before}<span class="chosen-file">Selected: {before.name}</span
          >{/if}</label
      >
      <label
        >After the flip<input
          disabled={busy}
          type="file"
          accept="image/*"
          aria-label="After the flip"
          onchange={(e) => {
            after = e.currentTarget.files?.[0];
            success = "";
          }}
        />
        {#if after}<span class="chosen-file">Selected: {after.name}</span
          >{/if}</label
      >
      <p>
        Images fill the screen. Finish adjusting the animation first; create the
        switch again if you change its timing.
      </p>
      {#if busy}<progress
          max="1"
          value={progress}
          aria-label="Creating screen switch"
        ></progress>
        <p role="status">
          Creating screen switch… {Math.round(progress * 100)}%
        </p>{/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      {#if success}<p class="success" role="status">{success}</p>{/if}
      <div class="actions">
        <Button
          variant="outline"
          style="color: var(--foreground)"
          disabled={busy || !cue}
          onclick={() => create(true)}>Try demo</Button
        ><Button
          disabled={busy || !cue || !before || !after}
          onclick={() => create()}>Create screen switch</Button
        >
      </div>
      <Button
        variant="ghost"
        disabled={busy}
        onclick={() => {
          open = false;
        }}>Back to editor</Button
      >
    </div>
  </DialogContent>
</Dialog>

<style>
  .screen-switch-bar {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    padding: 9px 18px;
    background: var(--muted);
    border-bottom: 1px solid var(--border);
    font-size: 12px;
  }
  .screen-switch-bar > span {
    margin-right: auto;
  }
  .switch-form {
    display: grid;
    gap: 16px;
  }
  .switch-form label {
    display: grid;
    gap: 8px;
    font-size: 13px;
  }
  .switch-form input,
  .switch-form select {
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 100%;
    min-width: 0;
  }
  .chosen-file {
    font-size: 11px;
    color: var(--muted-foreground);
    overflow-wrap: anywhere;
  }
  .switch-form p {
    font-size: 12px;
    line-height: 1.6;
    color: var(--muted-foreground);
  }
  .switch-form .error {
    color: #e66565;
  }
  .switch-form .success {
    color: var(--foreground);
    font-weight: 600;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 10px;
  }
  progress {
    width: 100%;
  }
</style>
