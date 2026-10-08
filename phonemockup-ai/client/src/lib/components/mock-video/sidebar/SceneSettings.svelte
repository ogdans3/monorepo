<script lang="ts">
    import {Label} from "$lib/components/ui/label";
    import {Input} from "$lib/components/ui/input";
    import * as Select from "$lib/components/ui/select";
    import {Badge} from "$lib/components/ui/badge";

    import {onMount} from "svelte";
    import {Checkbox} from "$lib/components/ui/checkbox";
    import {unfocusElement} from "$lib/components/mock-video/unfocus";
    import {PresetName, type RGBA} from "$lib/models/models";
    import {project} from "$lib/stores/project.svelte";

    const presetKeys = Object.values(PresetName) as PresetName[];
    const triggerText = $derived(
        project.sceneSettings.selectedPreset ? (project.sceneSettings.selectedPreset as string) : "Select a preset"
    );
    const width = $derived(Math.round(project.sceneResolution.x));
    const height = $derived(Math.round(project.sceneResolution.y));

    // Local UI state: hex (for <input type="color">) and alpha 0..1
    let backgroundHex = $state("#111111"); // #RRGGBB
    let backgroundAlpha = $state(1); // 0..1

    function clamp01(n: number) {
        return Math.max(0, Math.min(1, n));
    }

    function hexToRgb(hex: string): [number, number, number] | null {
        const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
        if (!m) return null;
        const n = parseInt(m[1], 16);
        const r = (n >> 16) & 0xff;
        const g = (n >> 8) & 0xff;
        const b = n & 0xff;
        return [r, g, b];
    }

    function rgbToHex(r: number, g: number, b: number): string {
        return (
            "#" +
            [r, g, b]
                .map((v) =>
                    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")
                )
                .join("")
                .toUpperCase()
        );
    }

    function onBgHexChange(hex: string) {
        const normalized = hex.startsWith("#") ? hex : `#${hex}`;
        const rgb = hexToRgb(normalized);
        if (rgb) {
            backgroundHex = normalized;
            const [r, g, b] = rgb;
            const rgba: [number, number, number, number] = [r, g, b, backgroundAlpha];
            project.sceneSettings.backgroundColor = rgba;
        }
    }

    // Checkbox: true -> alpha 0 (transparent), false -> alpha 1 (opaque)
    function onAlphaCheckboxChange(checked: boolean) {
        const a = checked ? 0 : 1;
        backgroundAlpha = a;
        const rgb = hexToRgb(backgroundHex);
        if (rgb) {
            const [r, g, b] = rgb;
            const rgba: [number, number, number, number] = [r, g, b, backgroundAlpha];
            project.sceneSettings.backgroundColor = rgba;
        }
        unfocusElement();
    }

    function isValidRGBA(rgba: unknown): rgba is RGBA {
        return Array.isArray(rgba) &&
            rgba.length === 4 &&
            rgba.every((n, i) =>
                typeof n === "number" ? i < 3 ? n >= 0 && n <= 255 : n >= 0 && n <= 1 : false
            );
    }

    // Reactive effect to sync state
    $effect(() => {
        const rgba = project.sceneSettings.backgroundColor;

        if (isValidRGBA(rgba)) {
            const [r, g, b, a] = rgba;
            const hex = rgbToHex(r, g, b);
            if (backgroundHex !== hex) {
                backgroundHex = hex;
            }
            if (backgroundAlpha !== a) {
                backgroundAlpha = a;
            }
        }
    });
</script>

<section class="px-2 py-2 space-y-3" aria-label="Scene settings">
    <div class="flex items-center gap-2">
        <h3 class="text-sm font-medium">Scene</h3>
        <Badge class="ml-auto text-[11px] px-1.5 py-0.5" aria-live="polite">
            {width} × {height}
        </Badge>
    </div>

    <!-- Background transparency toggle -->
    <div class="flex items-center justify-between">
        <Label for="bg-alpha-toggle" class="text-xs text-muted-foreground flex justify-between w-full">
            Transparent background
            <Checkbox id="bg-alpha-toggle" checked={backgroundAlpha === 0}
                      onCheckedChange={(checked) => onAlphaCheckboxChange(checked)}
                      aria-label="Toggle transparent background"
            />
        </Label>
    </div>

    <!-- Background color -->
    <div class="grid gap-1.5">
        <Label for="bg-color" class="text-xs text-muted-foreground">
            Background color
        </Label>
        <Input
                id="bg-color"
                type="color"
                class="h-8 w-full p-1 cursor-pointer"
                bind:value={backgroundHex}
                onchange={(e) => onBgHexChange((e.target as HTMLInputElement).value)}
                oninput={(e) => onBgHexChange((e.target as HTMLInputElement).value)}
                aria-label="Scene background color"
        />
    </div>

    <!-- Resolution preset -->
    <div class="grid gap-1.5">
        <Label for="preset" class="text-xs text-muted-foreground">
            Resolution preset
        </Label>
        <Select.Root type="single" name="resolutionPreset" bind:value={project.sceneSettings.selectedPreset}
                     onValueChange={() => unfocusElement()}>
            <Select.Trigger
                    id="preset"
                    class="h-8 w-full rounded-md border bg-background px-2.5 text-sm inline-flex items-center justify-between"
                    aria-label="Select resolution preset"
            >
                {triggerText}
            </Select.Trigger>

            <Select.Content class="min-w-[14rem]">
                <Select.Group>
                    <Select.Label class="px-2 py-1 text-xs opacity-70">Presets</Select.Label>
                    {#each presetKeys as key (key)}
                        <Select.Item value={key} label={key} class="text-sm px-2 py-1.5">
                            {key}
                        </Select.Item>
                    {/each}
                </Select.Group>
            </Select.Content>
        </Select.Root>
    </div>

    <!-- Background transparency toggle -->
    <div class="flex items-center justify-between">
        <Label for="glass-reflections-toggle" class="text-xs text-muted-foreground w-full flex justify-between">
            Glass reflections enabled
            <Checkbox id="glass-reflections-toggle" checked={project.sceneSettings.glassReflections}
                      onCheckedChange={(checked) => {project.sceneSettings.glassReflections = checked; unfocusElement()}}/>
        </Label>
    </div>
</section>