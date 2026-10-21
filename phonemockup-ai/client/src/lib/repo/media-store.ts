// The files behind a locally saved project. localStorage only holds strings,
// so the project JSON goes there and its screen media goes to IndexedDB, keyed
// by project id.

const DB_NAME = "phonemockup";
const DB_VERSION = 1;
const STORE = "project-media";

export type ProjectMedia = {
    /** What was on the phone's screen, or null for the demo recording. */
    screen: File | null;
    /** The bulk upload list, in order. */
    bulk: File[];
};

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("IndexedDB is not available"));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE)) {
                request.result.createObjectStore(STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const request = run(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(request.result);
            tx.onerror = () => reject(tx.error ?? request.error);
            tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
        });
    } finally {
        db.close();
    }
}

// Safari's private windows refuse File and Blob values ("Error preparing
// Blob/File data to be stored in object store") but take ArrayBuffers.
// Files are stored as files where the browser allows it, which keeps a long
// recording out of memory, and as bytes where it doesn't.
type InlineFile = {name: string; type: string; lastModified: number; data: ArrayBuffer};
type StoredFile = File | InlineFile;
type StoredMedia = {screen: StoredFile | null; bulk?: StoredFile[]};

async function inline(file: File): Promise<InlineFile> {
    return {name: file.name, type: file.type, lastModified: file.lastModified, data: await file.arrayBuffer()};
}

/**
 * A stored entry as a file, or null when it isn't one. A damaged or
 * hand-edited record used to come back as a 9-byte file named "undefined",
 * and a nameless Blob as a black screen that the next save deleted.
 */
function revive(file: unknown): File | null {
    if (file instanceof File) return file;
    if (file instanceof Blob) return new File([file], "Saved screen", {type: file.type});
    if (file && typeof file === "object") {
        const {name, type, lastModified, data} = file as Partial<InlineFile>;
        if (typeof name === "string" && (data instanceof ArrayBuffer || ArrayBuffer.isView(data))) {
            return new File([data], name, {
                type: typeof type === "string" ? type : "",
                lastModified: Number.isFinite(lastModified) ? lastModified : Date.now(),
            });
        }
    }
    return null;
}

export async function saveProjectMedia(projectId: string, media: ProjectMedia): Promise<void> {
    if (!media.screen && media.bulk.length === 0) {
        await deleteProjectMedia(projectId);
        return;
    }
    try {
        await withStore("readwrite", (store) => store.put(media, projectId));
    } catch (error) {
        // Bytes take the same room as the file, so a full quota stays full.
        if (error instanceof DOMException && error.name === "QuotaExceededError") throw error;
        const stored: StoredMedia = {
            screen: media.screen && await inline(media.screen),
            bulk: await Promise.all(media.bulk.map(inline)),
        };
        await withStore("readwrite", (store) => store.put(stored, projectId));
    }
}

/** What was stored, minus anything that isn't a file; `damaged` when something was left out. */
export async function loadProjectMedia(projectId: string): Promise<(ProjectMedia & {damaged: boolean}) | null> {
    const media = await withStore<unknown>("readonly", (store) => store.get(projectId));
    if (media === undefined || media === null) return null;
    const record = (typeof media === "object" ? media : {}) as Partial<StoredMedia>;
    const screen = record.screen == null ? null : revive(record.screen);
    const stored: unknown[] = Array.isArray(record.bulk) ? record.bulk : [];
    const bulk = stored.map(revive).filter((file): file is File => file !== null);
    const damaged = typeof media !== "object" || (record.screen != null && !screen) || bulk.length < stored.length
        || (record.bulk !== undefined && !Array.isArray(record.bulk));
    return {screen, bulk, damaged};
}

export async function deleteProjectMedia(projectId: string): Promise<void> {
    await withStore("readwrite", (store) => store.delete(projectId));
}
