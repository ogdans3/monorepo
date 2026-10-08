import {db} from './client';
import {user, project} from './schema';
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
export async function createUser(workosUserId: string): Promise<DBUser> {
    const inserted = await db
        .insert(user)
        .values({id: workosUserId})
        .onConflictDoNothing()
        .returning({id: user.id, createdAt: user.createdAt});

    if (inserted.length === 0) {
        return getUser(workosUserId) as Promise<DBUser>;
    }
    return inserted[0];
}

export async function getUser(workosUserId: string): Promise<DBUser | null> {
    const rows = await db
        .select({
            id: user.id,
            createdAt: user.createdAt,
        })
        .from(user)
        .where(eq(user.id, workosUserId))
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
        name: string | null;
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