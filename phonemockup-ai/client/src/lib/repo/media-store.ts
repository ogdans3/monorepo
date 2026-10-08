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

export async function saveProjectMedia(projectId: string, media: ProjectMedia): Promise<void> {
    if (!media.screen && media.bulk.length === 0) {
        await deleteProjectMedia(projectId);
        return;
    }
    await withStore("readwrite", (store) => store.put(media, projectId));
}

export async function loadProjectMedia(projectId: string): Promise<ProjectMedia | null> {
    const media = await withStore<ProjectMedia | undefined>("readonly", (store) => store.get(projectId));
    return media ?? null;
}

export async function deleteProjectMedia(projectId: string): Promise<void> {
    await withStore("readwrite", (store) => store.delete(projectId));
}
