import macbookPro14M4 from "./macbook-pro-14-m4.model.json";
import testPhone from "./iphone-1.model.json";
import iphoneTestPhone from "./iphone-2.model.json";
import iphoneTestPhone3 from "./iphone-3.model.json";
import iphoneTestPhone3Point1 from "./iphone-3-1.model.json";
import iphoneTestPhone3Point2 from "./iphone-3-2.model.json";
import iphone16Pro from "./iphone-16-pro.model.json";
import iphone17Test1 from "./iphone-17.1.model.json";
import iphone17WhiteTest1 from "./iphone-17-white.1.model.json";
import iphone17ProMax from "./iphone-17-pro-max.model.json";
import iphone17ProMaxBaked from "./iphone-17-pro-max-baked.model.json";
import iphone17ProMaxBakedFiverr from "./iphone-17-pro-max-baked-fiverr.model.json";
import galaxyS24Ultra from "./galaxy-s24-ultra.model.json";
import pixel9Pro from "./pixel-9-pro.model.json";
import pixel10 from "./pixel-10.model.json";
import pixel10Baked from "./pixel-10-baked.model.json";
import type {Vec3} from "$lib/components/mock-video/Animation";

export type Layer = {
    /** Case-insensitive part of a mesh or material name. */
    match: string;
    material: string;
    /**
     * "planar" throws away the mesh's own texture coordinates and projects
     * the image flat onto the screen, upright as seen from the front. For
     * models whose screen has no usable UVs, or UVs into a texture atlas.
     */
    uv?: "planar" | "upright";
}

export type Model = {
    id: string;
    name: string;
    modelPath: string;
    defaultPosition: Vec3,
    defaultRotation: Vec3,
    layers: Layer[];
    caseColor: string | null;
    /** Exact node names for the removable front camera cutout and its optics. */
    cameraIsland?: {nodes: string[]; label?: string};
    /** Defaults to visible when omitted, including in older saved projects. */
    showCameraIsland?: boolean;
    /** Rigid display articulation around the named node's local X axis. */
    hinge?: {node: string; minAngle: number; maxAngle: number; defaultAngle: number};
    lidAngle?: number;
    /** Seconds to ease from closed to lidAngle; absent/zero holds the pose. */
    lidOpenDuration?: number;
}
/** The audited models offered for new mockups. */
// JSON imports widen the validated UV enum values to string.
export const models = [iphone16Pro, pixel9Pro, galaxyS24Ultra, macbookPro14M4] as Model[];

// Preserve existing projects and API calls without offering prototypes in the picker.
const legacyModels: Model[] = [
    testPhone, iphoneTestPhone, iphoneTestPhone3, iphoneTestPhone3Point1,
    iphoneTestPhone3Point2, iphone17Test1, iphone17WhiteTest1,
    iphone17ProMax, iphone17ProMaxBaked, iphone17ProMaxBakedFiverr,
    pixel10, pixel10Baked,
];

export function getModel(id: string | undefined): Model | undefined {
    if (id === "iphone-16-pro-full-screen") return {...getModel("iphone-16-pro")!, showCameraIsland: false};
    return models.find((model) => model.id === id) ?? legacyModels.find((model) => model.id === id);
}

export default getModel("pixel-9-pro")!;
