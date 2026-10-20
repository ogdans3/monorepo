import {randomUUID} from 'node:crypto';
import {db} from './client.js';
import {user, project, file} from './schema.js';
import {
    and,
    desc,
    eq,
    gt,
    lt,
    or,
    sql,
} from 'drizzle-orm';

// Types
export type DBUser = {
    id: string;
    createdAt: Date;
};

export type DBProject = {
    id: string; // uuid
    owner: string;
    name: string;
    fileUrl: string | null;
    fileName: string | null;
    projectJson: unknown | null;
    createdAt: Date;
    updatedAt: Date;
};

// Create or get user (UPSERT-like behavior)
export async function createUser(userId: string): Promise<DBUser> {
    const inserted = await db
        .insert(user)
        .values({id: userId})
        .onConflictDoNothing()
        .returning({id: user.id, createdAt: user.createdAt});

    if (inserted.length === 0) {
        return getUser(userId) as Promise<DBUser>;
    }
    return inserted[0];
}

export async function getUser(userId: string): Promise<DBUser | null> {
    const rows = await db
        .select({
            id: user.id,
            createdAt: user.createdAt,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

    return rows[0] ?? null;
}

// Create project
type CreateProjectInput = {
    owner: string;
    name: string;
    fileUrl?: string | null;
    fileName?: string | null;
    projectJson?: unknown; // will be stored as JSON/JSONB
};

export async function createProject(
    input: CreateProjectInput
): Promise<DBProject> {
    const [row] = await db
        .insert(project)
        .values({
            owner: input.owner,
            name: input.name,
            fileUrl: input.fileUrl ?? null,
            fileName: input.fileName ?? null,
            projectJson: input.projectJson ?? null,
        })
        .returning({
            id: project.id,
            owner: project.owner,
            name: project.name,
            fileUrl: project.fileUrl,
            fileName: project.fileName,
            projectJson: project.projectJson,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
        });

    return row;
}

// Get project by id (uuid)
export async function getProject(projectId: string): Promise<DBProject | null> {
    const rows = await db
        .select({
            id: project.id,
            owner: project.owner,
            name: project.name,
            fileUrl: project.fileUrl,
            fileName: project.fileName,
            projectJson: project.projectJson,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
        })
        .from(project)
        .where(eq(project.id, projectId))
        .limit(1);

    return rows[0] ?? null;
}

// Pagination by owner with cursor (createdAt, id)
// Supports limit and an optional cursor { createdAt, id } for stable pagination.
type GetProjectsOpts = {
    limit?: number;
    after?: { createdAt: Date; id: string } | null;
};

export async function getProjects(
    userId: string,
    opts?: GetProjectsOpts
): Promise<DBProject[]> {
    const limit =
        opts?.limit && opts.limit > 0 && opts.limit <= 200 ? opts.limit : 50;

    const whereBase = eq(project.owner, userId);

    // For cursor pagination: fetch rows older than the cursor (DESC)
    const whereWithCursor = opts?.after
        ? and(
            whereBase,
            or(
                lt(project.createdAt, opts.after.createdAt),
                and(
                    eq(project.createdAt, opts.after.createdAt),
                    lt(project.id, opts.after.id as unknown as string)
                )
            )
        )
        : whereBase;

    return db
        .select({
            id: project.id,
            owner: project.owner,
            name: project.name,
            fileUrl: project.fileUrl,
            fileName: project.fileName,
            projectJson: project.projectJson,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
        })
        .from(project)
        .where(whereWithCursor)
        .orderBy(desc(project.createdAt), desc(project.id))
        .limit(limit);
}

// Update project (partial, owner-scoped)
type UpdateProjectInput = {
    id: string; // uuid
    owner: string;
    name?: string;
    fileUrl?: string | null;
    fileName?: string | null;
    projectJson?: unknown;
};

export async function updateProject(
    input: UpdateProjectInput
): Promise<DBProject | null> {
    const values: Partial<{
        name: string;
        fileUrl: string | null;
        fileName: string | null;
        projectJson: unknown | null;
        updatedAt: Date;
    }> = {};

    if (input.name !== undefined) values.name = input.name;
    if (input.fileUrl !== undefined) values.fileUrl = input.fileUrl;
    if (input.fileName !== undefined) values.fileName = input.fileName;
    if (input.projectJson !== undefined) values.projectJson = input.projectJson;

    if (Object.keys(values).length === 0) {
        // Nothing to change, but still only the owner may read it back.
        const existing = await getProject(input.id);
        return existing && existing.owner === input.owner ? existing : null;
    }

    // Optionally bump updatedAt; if you have a DB trigger, you can omit this:
    values.updatedAt = new Date();

    const rows = await db
        .update(project)
        .set(values)
        .where(and(eq(project.id, input.id), eq(project.owner, input.owner)))
        .returning({
            id: project.id,
            owner: project.owner,
            name: project.name,
            fileUrl: project.fileUrl,
            fileName: project.fileName,
            projectJson: project.projectJson,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
        });

    return rows[0] ?? null;
}

const projectColumns = {
    id: project.id,
    owner: project.owner,
    name: project.name,
    fileUrl: project.fileUrl,
    fileName: project.fileName,
    projectJson: project.projectJson,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
};

/** More placeholders than one save could ever fill is a malformed request. */
export const MAX_FILES_PER_SAVE = 50;

/** Empty file rows a save asks for, each a fileKey to upload into later. */
function placeholderRows(projectId: string, count: number) {
    const n = Math.min(MAX_FILES_PER_SAVE, Math.max(0, Math.floor(Number(count) || 0)));
    return Array.from({length: n}, () => ({
        projectId,
        fileType: "application/octet-stream",
        url: "",
        sizeBytes: 0,
        fileName: "placeholder",
        storageProvider: "backblaze_b2",
    }));
}

/**
 * Creates the project and its upload placeholders together. The Neon HTTP
 * driver has no interactive transactions, but a batch runs as one: both
 * inserts land or neither does, so a failed save never leaves a project behind
 * for the client's retry to duplicate. The id is made here so the placeholders
 * can point at it inside the same batch.
 */
export async function createProjectWithFiles(
    input: CreateProjectInput & {fileCount?: number},
): Promise<{project: DBProject; fileKeys: string[]}> {
    const id = randomUUID();
    const insertProject = db
        .insert(project)
        .values({
            id,
            owner: input.owner,
            name: input.name,
            fileUrl: input.fileUrl ?? null,
            fileName: input.fileName ?? null,
            projectJson: input.projectJson ?? null,
        })
        .returning(projectColumns);
    const rows = placeholderRows(id, input.fileCount ?? 0);
    if (!rows.length) {
        const [created] = await insertProject;
        return {project: created, fileKeys: []};
    }
    const [[created], files] = await db.batch([
        insertProject,
        db.insert(file).values(rows).returning({id: file.id}),
    ]);
    return {project: created, fileKeys: files.map((f) => f.id)};
}

/**
 * Saves over a project its owner holds, with any new placeholders, in one
 * batch for the same reason. Null when the project isn't the owner's.
 */
export async function updateProjectWithFiles(
    input: UpdateProjectInput & {fileCount?: number},
): Promise<{project: DBProject; fileKeys: string[]} | null> {
    const existing = await getProject(input.id);
    if (!existing || existing.owner !== input.owner) return null;

    const values: Partial<{
        name: string;
        fileUrl: string | null;
        fileName: string | null;
        projectJson: unknown | null;
        updatedAt: Date;
    }> = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.fileUrl !== undefined) values.fileUrl = input.fileUrl;
    if (input.fileName !== undefined) values.fileName = input.fileName;
    if (input.projectJson !== undefined) values.projectJson = input.projectJson;
    const rows = placeholderRows(input.id, input.fileCount ?? 0);
    const insertFiles = rows.length ? db.insert(file).values(rows).returning({id: file.id}) : null;

    if (Object.keys(values).length === 0) {
        // Nothing to change: no new updatedAt, only the placeholders if any.
        const files = insertFiles ? await insertFiles : [];
        return {project: existing, fileKeys: files.map((f) => f.id)};
    }
    values.updatedAt = new Date();
    const update = db
        .update(project)
        .set(values)
        .where(and(eq(project.id, input.id), eq(project.owner, input.owner)))
        .returning(projectColumns);
    if (!insertFiles) {
        const [updated] = await update;
        return updated ? {project: updated, fileKeys: []} : null;
    }
    const [[updated], files] = await db.batch([update, insertFiles]);
    return updated ? {project: updated, fileKeys: files.map((f) => f.id)} : null;
}
