<script lang="ts">
    // Ids for the selects' labels: the value shown stays part of the name.
    const uid = $props.id();
  import { Label } from "$lib/components/ui/label";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import * as Select from "$lib/components/ui/select";
  import { models } from "$lib/models/3d-models/3d-models-spec";
  import { unfocusElement } from "$lib/components/mock-video/unfocus";
  import { project } from "$lib/stores/project.svelte";

  function normalizeHex(hex: string) {
    const h = hex.startsWith("#") ? hex : `#${hex}`;
    return /^#[0-9a-fA-F]{6}$/.test(h) ? h : null;
  }

  function onColorInput(v: string) {
    const ok = normalizeHex(v);
    if (!ok) return;
    const current = project.model;
    if (!current || current.caseColor === ok) return;
    project.model = { ...current, caseColor: ok };
  }

  function setModelById(id: string) {
    const next = models.find((m) => m.id === id);
    if (!next) return;

    const current = project.model;
    if (current?.id === next.id) return;
    // Appearance choices carry over when switching devices.
    project.model = {
      ...next,
      caseColor: current?.caseColor ?? next.caseColor,
      showLogo: current?.showLogo ?? next.showLogo ?? true,
    };
  }
</script>

<section class="px-2 py-2 space-y-3" aria-label="Model settings">
  <div class="grid gap-1.5">
    <Label for="model-type" class="text-xs text-muted-foreground"
      >Model type</Label
    >

    <span id={`${uid}-model-label`} class="sr-only">Select 3D model</span>
    <Select.Root
      type="single"
      name="modelId"
      value={project.model?.id ?? ""}
      onValueChange={(id) => {
        setModelById(id);
        unfocusElement();
      }}
    >
      <Select.Trigger
        id="model-type"
        class="h-8 w-full rounded-md border bg-background px-2.5 text-sm inline-flex items-center justify-between"
        aria-labelledby={`${uid}-model-label ${uid}-model-value`}
      >
        <span id={`${uid}-model-value`}>{project.model?.name ?? "Select model"}</span>
      </Select.Trigger>

      <Select.Content aria-labelledby={`${uid}-model-label`} class="min-w-[16rem]">
        <Select.Group>
          <Select.Label>Available models</Select.Label>
          {#each models as m (m.id)}
            <Select.Item value={m.id} label={m.name}>
              <span>{m.name}</span>
            </Select.Item>
          {/each}
        </Select.Group>
      </Select.Content>
    </Select.Root>
  </div>

  {#if project.model.logo}
    <label class="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={project.model.showLogo !== false}
        onchange={(event) => {
          project.model = {
            ...project.model,
            showLogo: event.currentTarget.checked,
          };
        }}
      />
      Show logo
    </label>
  {/if}

  {#if project.model.cameraIsland}
    <label class="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        role="switch"
        checked={project.model.showCameraIsland !== false}
        onchange={(event) => {
          project.model = {
            ...project.model,
            showCameraIsland: event.currentTarget.checked,
          };
        }}
      />
      {project.model.cameraIsland.label ?? "Show Dynamic Island"}
    </label>
  {/if}

  {#if project.model.hinge}
    <div class="grid gap-2">
      <Label for="lid-angle" class="text-xs text-muted-foreground">
        Lid angle · {Math.round(
          project.model.lidAngle ?? project.model.hinge.defaultAngle,
        )}°
      </Label>
      <input
        id="lid-angle"
        type="range"
        class="w-full accent-primary"
        min={project.model.hinge.minAngle}
        max={project.model.hinge.maxAngle}
        step="1"
        value={project.model.lidAngle ?? project.model.hinge.defaultAngle}
        oninput={(event) => {
          project.model = {
            ...project.model,
            lidAngle: Number(event.currentTarget.value),
          };
        }}
      />
      <label class="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={(project.model.lidOpenDuration ?? 0) > 0}
          onchange={(event) => {
            project.model = {
              ...project.model,
              lidOpenDuration: event.currentTarget.checked ? 2.5 : 0,
            };
          }}
        />
        Open lid during animation
      </label>
      {#if (project.model.lidOpenDuration ?? 0) > 0}
        <Label for="lid-duration" class="text-xs text-muted-foreground"
          >Opening duration (seconds)</Label
        >
        <Input
          id="lid-duration"
          type="number"
          min="0.1"
          max="60"
          step="0.1"
          value={project.model.lidOpenDuration}
          oninput={(event) => {
            const value = Number(event.currentTarget.value);
            if (Number.isFinite(value) && value >= 0.1 && value <= 60)
              project.model = { ...project.model, lidOpenDuration: value };
          }}
          onchange={(event) => {
            // Leaving the field shows the duration the project really uses.
            const field = event.currentTarget;
            const value = Number(field.value);
            const used =
              field.value.trim() !== "" && Number.isFinite(value)
                ? Math.min(60, Math.max(0.1, value))
                : (project.model.lidOpenDuration ?? 2.5);
            project.model = { ...project.model, lidOpenDuration: used };
            field.value = String(used);
          }}
        />
      {/if}
    </div>
  {/if}

  <div class="grid gap-1.5">
    <Label for="model-color" class="text-xs text-muted-foreground"
      >Case color</Label
    >
    <div class="studio-color-field">
      <Input
        id="model-color"
        type="color"
        value={project.model?.caseColor ?? "#cccccc"}
        oninput={(e) => onColorInput(e.currentTarget.value)}
        onchange={(e) => onColorInput(e.currentTarget.value)}
        aria-label="Case color"
      />
      <span>{project.model?.caseColor ?? "Original finish"}</span>
      {#if project.model?.caseColor}
        <Button
          variant="secondary"
          size="sm"
          class="h-7 px-2 ml-auto text-xs"
          onclick={() => (project.model = { ...project.model, caseColor: null })}
          >Original finish</Button
        >
      {/if}
    </div>
  </div>
</section>
