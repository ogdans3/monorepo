import {v4 as uuid} from "uuid";
import type {
    Project,
    ProjectFile,
    ProjectSettings,
    ProjectTimelineSettings,
    Track
} from "$lib/components/mock-video/Project";
import defaultModel, {getModel, type Model} from "$lib/models/3d-models/3d-models-spec";
import type {Vec3} from '../components/mock-video/Animation';
import {PresetName, type Resolution, type RGBA} from "$lib/models/models";

// Scene presets
export const presets: Record<PresetName, Resolution> = {
    [PresetName.Portrait_4_5]: {width: 2160, height: 2700},
    [PresetName.FullHD_16_9]: {width: 3840, height: 2160},
    [PresetName.Square_1_1]: {width: 2160, height: 2160},
    [PresetName.TikTok_9_16]: {width: 2160, height: 3840},
    [PresetName.Cinema4K_21_9]: {width: 7680, height: 3292},
} as const;

// Scene settings interface
export interface SceneSettings {
    backgroundColor: RGBA;
    selectedPreset: PresetName;
    glassReflections: boolean;
}

const salmonPink = [255, 168, 168, 1] as RGBA;
const purple = [200, 151, 199, 1] as RGBA;
const transparent: RGBA = [200, 151, 199, 0];

/**
 * Bumped when what `toProject` writes changes meaning. Version 2 is the first
 * where a saved `caseColor` is something the user picked: before it the
 * picker never worked, so a saved colour is only the old catalogue default.
 */
export const PROJECT_FORMAT_VERSION = 2;

/**
 * The phone as the catalogue describes it today, keeping only what the user
 * chose. A saved project carries a copy of the whole model, including its file
 * path and defaults, which go stale when the catalogue is fixed.
 */
function resolveModel(saved: Model | undefined, formatVersion: number | undefined): Model {
    const current: Model = getModel(saved?.id) ?? saved ?? defaultModel;
    const pickedColor = (formatVersion ?? 1) >= 2 ? saved?.caseColor ?? null : null;
    return {...current, caseColor: pickedColor ?? current.caseColor ?? null,
        ...(current.cameraIsland ? {showCameraIsland: typeof saved?.showCameraIsland === "boolean"
            ? saved.showCameraIsland : current.showCameraIsland ?? true} : {}),
        ...(current.hinge ? {lidAngle: saved?.lidAngle ?? current.lidAngle,
            lidOpenDuration: saved?.lidOpenDuration ?? current.lidOpenDuration} : {})};
}

export class ProjectState {
    // Core properties
    id = $state(uuid());
    name = $state("Unnamed");
    savedOnServer = $state(false);
    isDirty = $derived(!this.savedOnServer);

    // Data collections
    tracks = $state<Track[]>([]);
    files = $state<ProjectFile[]>([]);
    isBulk = $derived(this.files.length > 1);

    demoMediaId = $state<"focus" | "workspace" | undefined>(undefined);

    // Model
    model = $state<Model>(defaultModel);

    // General settings
    settings = $state<ProjectSettings>({
        exportSettings: {kebabCase: true},
        fps: 60,
        videoLoop: true,
        autoplay: false,
    });

    timeline = $state<ProjectTimelineSettings>({
        endTime: 3,
    });

    // Scene settings (new grouped state)
    sceneSettings = $state<SceneSettings>({
        backgroundColor: transparent,
        selectedPreset: PresetName.FullHD_16_9,
        glassReflections: true,
    });

    // Derived scene resolution
    sceneResolution = $derived<Vec3>({
        x: presets[this.sceneSettings.selectedPreset].width,
        y: presets[this.sceneSettings.selectedPreset].height,
        z: 0,
    });

    save() {
        this.savedOnServer = true;
    }

    markDirty() {
        this.savedOnServer = false;
    }

    // Apply preset to scene settings
    applyPreset(name: PresetName) {
        this.sceneSettings.selectedPreset = name;
    }

    toProject(): Project {
        return {
            formatVersion: PROJECT_FORMAT_VERSION,
            id: this.id,
            name: this.name,
            model: this.model,
            files: this.files,
            tracks: this.tracks,
            settings: this.settings,
            timeline: this.timeline,
            savedOnServer: this.savedOnServer,
            sceneSettings: this.sceneSettings,
            demoMediaId: this.demoMediaId,
        } as Project;
    }

    fromProject(project: Project): void {
        this.id = project.id;
        this.name = project.name;
        this.savedOnServer = false;
        // Files are restored separately, from where their bytes are stored.
        this.files = [];

        // Clear existing tracks and load new ones
        this.tracks.forEach((track) =>
            track.animations.splice(0, track.animations.length)
        );
        this.tracks.splice(0, this.tracks.length, ...(project.tracks as Track[]));

        this.model = resolveModel(project.model, project.formatVersion);
        this.demoMediaId = project.demoMediaId === "focus" || project.demoMediaId === "workspace" ? project.demoMediaId : undefined;

        this.timeline = {...this.timeline, ...(project?.timeline ?? {})}
        this.settings = {
            ...this.settings,
            ...(project.settings ?? {}),
        };

        this.sceneSettings = {
            ...this.sceneSettings,
            ...(project.sceneSettings ?? {}),
        };
    }

    /** Forget the open project and start an empty one with default settings. */
    startNew() {
        const fresh = new ProjectState();
        this.id = fresh.id;
        this.name = fresh.name;
        this.savedOnServer = false;
        this.tracks = [];
        this.files = [];
        this.model = {...defaultModel};
        this.demoMediaId = undefined;
        this.settings = fresh.settings;
        this.timeline = fresh.timeline;
        this.sceneSettings = fresh.sceneSettings;
    }
}

// Singleton instance
export const project = new ProjectState();