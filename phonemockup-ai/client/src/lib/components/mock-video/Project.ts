import type {Animation} from "$lib/components/mock-video/Animation";
import type {Model} from "$lib/models/3d-models/3d-models-spec";
import {PresetName, type RGBA} from "$lib/models/models";

export type Track = {
    id: string;
    phoneName: string;
    animations: Animation[];
};

export type ExportSettings = {
    kebabCase: boolean;
}
export type ProjectSettings = {
    exportSettings: ExportSettings;
    fps: number,
    videoLoop: boolean,
    autoplay: boolean,
}

export type ProjectTimelineSettings= {
    endTime: number;
}

export type ProjectSceneSettings = {
    backgroundColor: RGBA;
    glassReflections: boolean;
    selectedPreset: PresetName;
}

export type Project = {
    /** See PROJECT_FORMAT_VERSION; missing on projects saved before it existed. */
    formatVersion?: number;
    id: string;
    name: string;
    savedOnServer: boolean;
    tracks: Track[];
    files: ProjectFile[];
    settings: ProjectSettings;
    timeline: ProjectTimelineSettings;
    sceneSettings: ProjectSceneSettings;
    model: Model;
    /** Null when the demo recording was showing. */
    screenMedia?: ScreenMediaInfo | null;
    /** Built-in sample, used only when there is no uploaded screen media. */
    demoMediaId?: "focus" | "workspace";
}

export type ProjectFile = {
    id: string;
    projectId: string;
    fileType: string;
    url?: string;
    fileName: string;
    sizeBytes: number;
    storageProvider: "local";
    fileBlob: File,
};

/** What a saved project had on the phone's screen; the bytes live in IndexedDB. */
export type ScreenMediaInfo = {
    fileName: string;
    fileType: string;
};

