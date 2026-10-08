// Enhanced local storage project management

import type {Project} from "$lib/components/mock-video/Project";

const LOCAL_PROJECT_PREFIX = "project:local:";

export function saveProjectToLocalStorage(
    project: Project,
): Project {
    if (typeof window === "undefined" || !("localStorage" in window)) {
        throw new Error("localStorage is not available");
    }

    const timestamp = new Date().toISOString();
    const projectId = project.id;
    const storageKey = `${LOCAL_PROJECT_PREFIX}${projectId}`;

    const payload = {
        ...project,
        id: projectId,
        name: project.name?.trim() || "Untitled Project",
        _metadata: {
            savedAt: timestamp,
            isLocalOnly: true,
            storageKey: storageKey
        }
    };

    try {
        // A File serialises to {}; its bytes are stored in IndexedDB instead.
        const json = JSON.stringify(payload, (key, value) => (key === "fileBlob" ? undefined : value));
        window.localStorage.setItem(storageKey, json);
        return project;
    } catch (err) {
        throw new Error(
            `Failed to save project to localStorage: ${
                (err as Error)?.message ?? err
            }`
        );
    }
}

export function listProjectsFromLocalStorage(): Array<{
    key: string;
    project: Project;
    metadata: {
        savedAt: string;
        isLocalOnly: boolean;
        storageKey: string;
    };
    error?: string;
}> {
    if (typeof window === "undefined" || !("localStorage" in window)) {
        return [];
    }

    const results: Array<{
        key: string;
        project: Project;
        metadata: any;
        error?: string;
    }> = [];

    for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key?.startsWith(LOCAL_PROJECT_PREFIX)) continue;

        const raw = window.localStorage.getItem(key);
        if (raw == null) continue;

        try {
            const project = JSON.parse(raw);
            results.push({
                key,
                project,
                metadata: project._metadata || {
                    savedAt: new Date().toISOString(),
                    isLocalOnly: true,
                    storageKey: key
                }
            });
        } catch (e) {
            results.push({
                key,
                project: null as any,
                metadata: null as any,
                error: (e as Error)?.message ?? "Failed to parse JSON"
            });
        }
    }

    // Sort by most recent first. An entry that failed to parse has no
    // metadata; it sorts last rather than taking the whole list down.
    const savedAt = (r: { metadata: any }) => new Date(r.metadata?.savedAt ?? 0).getTime() || 0;
    return results.sort((a, b) => savedAt(b) - savedAt(a));
}

export function getProjectFromLocalStorage(id: string): Project | null {
    if (typeof window === "undefined" || !("localStorage" in window)) {
        return null;
    }

    const key = id.startsWith(LOCAL_PROJECT_PREFIX)
        ? id
        : `${LOCAL_PROJECT_PREFIX}${id}`;

    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;

    try {
        const parsed = JSON.parse(raw);
        // Remove metadata before returning
        const {_metadata, ...project} = parsed;
        return project;
    } catch {
        return null;
    }
}

export function deleteProjectFromLocalStorage(id: string): boolean {
    if (typeof window === "undefined" || !("localStorage" in window)) {
        return false;
    }

    const key = id.startsWith(LOCAL_PROJECT_PREFIX)
        ? id
        : `${LOCAL_PROJECT_PREFIX}${id}`;

    try {
        window.localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

export function clearAllLocalProjects(): number {
    if (typeof window === "undefined" || !("localStorage" in window)) {
        return 0;
    }

    let count = 0;
    const keysToRemove: string[] = [];

    for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(LOCAL_PROJECT_PREFIX)) {
            keysToRemove.push(key);
        }
    }

    for (const key of keysToRemove) {
        try {
            window.localStorage.removeItem(key);
            count++;
        } catch {
            // Continue on error
        }
    }

    return count;
}