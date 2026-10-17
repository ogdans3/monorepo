<script lang="ts">
  import * as Collapsible from "$lib/components/ui/collapsible";
  import {
    SlidersHorizontal,
    Clapperboard,
    Smartphone,
    ChevronDown,
    Layers,
    ArrowUpRight,
    Settings2,
  } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import TransformControls from "./TransformControls.svelte";
  import SceneSettings from "./SceneSettings.svelte";
  import ModelPanel from "./ModelPanel.svelte";
  import ExportPanel from "./ExportPanel.svelte";
  import ProjectPanel from "./ProjectPanel.svelte";
  import BulkUpload from "./BulkUpload.svelte";
  import ScreenMedia from "./ScreenMedia.svelte";
  let {
    onDownloadImage,
    onDownloadVideo,
    activePanel = $bindable("transform"),
  } = $props();
</script>

{#snippet group(id: string, icon: any, label: string, content: Snippet)}
  <Collapsible.Root
    open={activePanel === id}
    onOpenChange={(open) => (activePanel = open ? id : "")}
    class="studio-inspector-group"
  >
    <Collapsible.Trigger class="studio-panel-trigger">
      {@const Icon = icon}<Icon size={16} /><span>{label}</span><ChevronDown
        class="studio-panel-chevron"
        size={14}
      />
    </Collapsible.Trigger>
    <Collapsible.Content class="studio-panel-content"
      >{@render content()}</Collapsible.Content
    >
  </Collapsible.Root>
{/snippet}
{#snippet model()}<ModelPanel />{/snippet}
{#snippet transform()}<TransformControls />{/snippet}
{#snippet scene()}<SceneSettings />{/snippet}
{#snippet bulk()}<BulkUpload />{/snippet}
{#snippet settings()}<ProjectPanel />{/snippet}
{#snippet exports()}<ExportPanel
    {onDownloadImage}
    {onDownloadVideo}
  />{/snippet}

<div class="studio-sidebar" data-testid="sidebar">
  <div class="studio-inspector-heading">
    <span>Scene inspector</span><span class="studio-inspector-index">01</span>
  </div>
  <div class="studio-inspector-scroll">
    <ScreenMedia />
    <div class="studio-panel-list">
      {@render group("model", Smartphone, "Model", model)}
      {@render group("transform", SlidersHorizontal, "Transform", transform)}
      {@render group("scene", Clapperboard, "Scene", scene)}
      {@render group("bulk", Layers, "Bulk upload", bulk)}
      {@render group("project", Settings2, "Project Settings", settings)}
      {@render group("export", ArrowUpRight, "Export / Share", exports)}
    </div>
    <div class="studio-inspector-note">
      Your project stays in this browser.<br />Save to pick up where you left
      off.
    </div>
  </div>
  <div class="studio-shortcuts">
    <span><kbd>Space</kbd> Play / pause</span><span
      ><kbd>←</kbd><kbd>→</kbd> Step frame</span
    >
  </div>
</div>
