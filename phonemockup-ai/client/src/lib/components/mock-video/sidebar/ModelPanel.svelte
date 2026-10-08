<script lang="ts">
    import {Label} from "$lib/components/ui/label";
    import {Input} from "$lib/components/ui/input";
    import * as Select from "$lib/components/ui/select";
    import {models} from "$lib/models/3d-models/3d-models-spec";
    import {get} from "svelte/store";
    import {videoController} from "$lib/stores/video.svelte";
    import {unfocusElement} from "$lib/components/mock-video/unfocus";
    import {project} from "$lib/stores/project.svelte";

    // The file field's value, bound so it can be cleared. Writing the field
    // directly doesn't work: the Input component binds the value too, and it
    // writes the picked path back, which a file field refuses with an error.
    let pickedPath = $state("");

    function onFileChange(e: Event) {
        unfocusElement();
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0] ?? null;
        // Clear it so picking the same file again still fires a change.
        pickedPath = "";
        if (!file) return;

        // A single picked file replaces any bulk list, like a drop does.
        project.files = [];
        get(videoController).setMediaSource(file);
    }

    function normalizeHex(hex: string) {
        const h = hex.startsWith("#") ? hex : `#${hex}`;
        return /^#[0-9a-fA-F]{6}$/.test(h) ? h : null;
    }

    function onColorInput(v: string) {
        const ok = normalizeHex(v);
        if (!ok) return;
        const current = project.model;
        if (!current || current.caseColor === ok) return;
        project.model = {...current, caseColor: ok};
    }

    function setModelById(id: string) {
        const next = models.find((m) => m.id === id);
        if (!next) return;

        const current = project.model;
        if (current?.id === next.id) return;
        // A colour the user picked carries over to the new phone.
        project.model = {...next, caseColor: current?.caseColor ?? next.caseColor};
    }
</script>

<section class="px-2 py-2 space-y-3" aria-label="Model settings">
    <div class="flex items-center gap-2">
        <h3 class="text-sm font-medium">Model</h3>
    </div>

    <div class="grid gap-1.5">
        <Label for="model-type" class="text-xs text-muted-foreground">Model type</Label>

        <Select.Root
                type="single"
                name="modelId"
                value={project.model?.id ?? ""}
                onValueChange={(id) => {setModelById(id); unfocusElement();}}
        >
            <Select.Trigger
                    id="model-type"
                    class="h-8 w-full rounded-md border bg-background px-2.5 text-sm inline-flex items-center justify-between"
                    aria-label="Select 3D model"
            >
                {project.model?.name ?? "Select model"}
            </Select.Trigger>

            <Select.Content class="min-w-[16rem]">
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

    {#if project.model.hinge}
        <div class="grid gap-2">
            <Label for="lid-angle" class="text-xs text-muted-foreground">
                Lid angle · {Math.round(project.model.lidAngle ?? project.model.hinge.defaultAngle)}°
            </Label>
            <input id="lid-angle" type="range" class="w-full accent-primary"
                min={project.model.hinge.minAngle} max={project.model.hinge.maxAngle} step="1"
                value={project.model.lidAngle ?? project.model.hinge.defaultAngle}
                oninput={(event) => {project.model = {...project.model, lidAngle: Number(event.currentTarget.value)};}} />
            <label class="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={(project.model.lidOpenDuration ?? 0) > 0}
                    onchange={(event) => {project.model = {...project.model, lidOpenDuration: event.currentTarget.checked ? 2.5 : 0};}} />
                Open lid during animation
            </label>
            {#if (project.model.lidOpenDuration ?? 0) > 0}
                <Label for="lid-duration" class="text-xs text-muted-foreground">Opening duration (seconds)</Label>
                <Input id="lid-duration" type="number" min="0.1" max="60" step="0.1"
                    value={project.model.lidOpenDuration}
                    oninput={(event) => {const value = Number(event.currentTarget.value); if (Number.isFinite(value) && value >= .1 && value <= 60) project.model = {...project.model, lidOpenDuration: value};}} />
            {/if}
        </div>
    {/if}

    <div class="grid gap-1.5">
        <Label for="model-color" class="text-xs text-muted-foreground">Case color</Label>
        <Input
                id="model-color"
                type="color"
                class="h-8 w-full p-1 cursor-pointer"
                value={project.model?.caseColor ?? "#cccccc"}
                oninput={(e) => onColorInput((e.target as HTMLInputElement).value)}
                onchange={(e) => onColorInput((e.target as HTMLInputElement).value)}
                aria-label="Case color"
        />
    </div>

    <div class="grid gap-1.5">
        <Label for="asset-file" class="text-xs text-muted-foreground">Image or video</Label>
        <Input
                id="asset-file"
                type="file"
                bind:value={pickedPath}
                accept="image/*,video/*"
                class="h-8 w-full cursor-pointer"
                onchange={onFileChange}
                aria-label="Choose an image or video file"
        />
    </div>
</section>