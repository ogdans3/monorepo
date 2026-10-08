import {z} from "zod";
import type {RGBA, SceneOptions} from "./renderer.js";

/** Resolutions the editor offers, kept byte-identical to the app's presets. */
export const PRESETS = {
    fullhd: {width: 3840, height: 2160},
    square: {width: 2160, height: 2160},
    tiktok: {width: 2160, height: 3840},
    cinema4k: {width: 7680, height: 3292}
} as const;

export type PresetName = keyof typeof PRESETS;

export const DEFAULT_MODEL = "pixel-10-baked";

export const sceneSchema = {
    model: z
        .string()
        .default(DEFAULT_MODEL)
        .describe(`Phone model id from list_phone_models. Defaults to ${DEFAULT_MODEL}.`),
    preset: z
        .enum(["fullhd", "square", "tiktok", "cinema4k"])
        .optional()
        .describe(
            "Output resolution preset: fullhd 3840x2160, square 2160x2160, " +
            "tiktok 2160x3840, cinema4k 7680x3292. Ignored when width/height are given."
        ),
    width: z.number().int().min(64).max(7680).optional().describe("Output width in pixels."),
    height: z.number().int().min(64).max(7680).optional().describe("Output height in pixels."),
    background: z
        .string()
        .default("transparent")
        .describe(
            'Background as "transparent", "#RRGGBB" or "#RRGGBBAA". ' +
            "Transparent needs a format that carries alpha (png, webm, gif)."
        ),
    glassReflections: z
        .boolean()
        .default(true)
        .describe("Render the screen under glass, picking up scene reflections."),
    caseColor: z
        .string()
        .optional()
        .describe('Override the phone body colour, e.g. "#1d1d1f".'),
    showCameraIsland: z.boolean().optional().describe("Show the front Dynamic Island on supported iPhones. Omit to use the selected model’s default."),
    lidAngle: z.number().min(0).max(130).optional().describe("Lid opening in degrees for hinged laptops; 0 closes it."),
    lidOpenDuration: z.number().min(0).max(60).optional().describe("Seconds to open a laptop from closed to lidAngle; 0 holds the angle."),
    antialias: z
        .boolean()
        .default(true)
        .describe(
            "Smooth the phone's edges. Rendering is software-rasterised, so turning " +
            "this off is roughly 3x faster at the cost of visibly jagged edges — " +
            "worth it for long videos or draft renders."
        )
};

export type SceneInput = {
    model: string;
    preset?: PresetName;
    width?: number;
    height?: number;
    background: string;
    glassReflections: boolean;
    caseColor?: string;
    antialias: boolean;
    showCameraIsland?: boolean;
    lidAngle?: number;
    lidOpenDuration?: number;
};

export function resolveScene(input: SceneInput, fallback: {width: number; height: number}): SceneOptions {
    const preset = input.preset ? PRESETS[input.preset] : undefined;
    return {
        modelId: input.model,
        width: input.width ?? preset?.width ?? fallback.width,
        height: input.height ?? preset?.height ?? fallback.height,
        background: parseBackground(input.background),
        glassReflections: input.glassReflections,
        caseColor: input.caseColor ?? undefined,
        showCameraIsland: input.showCameraIsland,
        lidAngle: input.lidAngle,
        lidOpenDuration: input.lidOpenDuration,
        antialias: input.antialias
    };
}

/** `[r, g, b, a]` with 0-255 channels and 0-1 alpha, matching the app's RGBA. */
export function parseBackground(value: string): RGBA {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "transparent" || trimmed === "none") return [0, 0, 0, 0];

    const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
    const expanded =
        hex.length === 3 || hex.length === 4
            ? hex.split("").map((c) => c + c).join("")
            : hex;

    if (expanded.length !== 6 && expanded.length !== 8) {
        throw new Error(
            `Invalid background "${value}". Use "transparent", "#RRGGBB" or "#RRGGBBAA".`
        );
    }
    if (!/^[0-9a-f]+$/.test(expanded)) {
        throw new Error(`Invalid background "${value}". Not a hex colour.`);
    }

    const channel = (i: number) => parseInt(expanded.slice(i * 2, i * 2 + 2), 16);
    return [
        channel(0),
        channel(1),
        channel(2),
        expanded.length === 8 ? channel(3) / 255 : 1
    ];
}

export function isTransparent(background: RGBA): boolean {
    return background[3] < 1;
}
