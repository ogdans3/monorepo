import {Router, type NextFunction, type Request, type Response} from "express";
import fileRoutes from "./file";
import {currentUser, withAuth} from "../middleware/auth";
import {
    createProject,
    getProject,
    getProjects,
    updateProject,
} from "../db/queries";
import {db} from "../db/client";
import {file as fileTable} from "../db/schema";

const router = Router();

/** More placeholders than one save could ever fill is a malformed request. */
const MAX_FILES_PER_SAVE = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function createFilePlaceholders(
    projectId: string,
    count: number
): Promise<string[]> {
    const n = Math.min(MAX_FILES_PER_SAVE, Math.max(0, Math.floor(Number(count) || 0)));
    if (!n) return [];
    const values = Array.from({length: n}).map(() => ({
        projectId,
        fileType: "application/octet-stream",
        url: "",
        sizeBytes: 0,
        fileName: "placeholder",
        storageProvider: "backblaze_b2",
    }));
    const rows = await db
        .insert(fileTable)
        .values(values)
        .returning({id: fileTable.id});
    return rows.map((r) => r.id);
}

/**
 * The client sends the project as a JSON string; the column is JSON. Storing
 * the string as is would save a JSON string, not the object it spells.
 */
function parseProjectJson(value: unknown): unknown {
    if (typeof value !== "string") return value;
    return JSON.parse(value);
}

function fail(res: Response, status: number, message: string, err?: unknown) {
    // Details go to the log; the client gets a message that leaks nothing.
    console.error(status, message, (err as Error)?.message ?? "");
    return res.status(status).json({error: message});
}

/** 404s unless the `:projectId` in the path is a project the user owns. */
export async function requireOwnedProject(req: Request, res: Response, next: NextFunction) {
    const projectId = (req.params as {projectId?: string}).projectId;
    if (!projectId || !UUID.test(projectId)) return fail(res, 404, "Project not found");
    try {
        const p = await getProject(projectId);
        if (!p || p.owner !== currentUser(res).id) return fail(res, 404, "Project not found");
        return next();
    } catch (err) {
        return fail(res, 500, "Failed to load project", err);
    }
}

router.get("/", withAuth, async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        // Cursor: the createdAt and id of the last project on the previous page.
        const afterCreatedAt = req.query.afterCreatedAt ? new Date(String(req.query.afterCreatedAt)) : null;
        const afterId = req.query.afterId ? String(req.query.afterId) : null;
        const after =
            afterCreatedAt && !Number.isNaN(afterCreatedAt.getTime()) && afterId && UUID.test(afterId)
                ? {createdAt: afterCreatedAt, id: afterId}
                : null;
        const rows = await getProjects(currentUser(res).id, {limit, after});
        return res.status(200).json(rows);
    } catch (err) {
        return fail(res, 500, "Failed to fetch projects", err);
    }
});

router.get("/:id", withAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const p = UUID.test(id) ? await getProject(id) : null;
        if (!p || p.owner !== currentUser(res).id) {
            return fail(res, 404, "Project not found");
        }
        return res.status(200).json(p);
    } catch (err) {
        return fail(res, 500, "Failed to fetch project", err);
    }
});

router.post("/", withAuth, async (req, res) => {
    const {name, projectJson, fileCount} = req.body ?? {};
    if (!name || typeof name !== "string") {
        return fail(res, 400, "Missing required field: name");
    }
    let json: unknown;
    try {
        json = parseProjectJson(projectJson);
    } catch (err) {
        return fail(res, 400, "projectJson is not valid JSON", err);
    }
    try {
        const created = await createProject({
            owner: currentUser(res).id,
            name,
            projectJson: json,
        });
        const fileKeys = await createFilePlaceholders(created.id, Number(fileCount || 0));
        return res.status(201).json({project: created, fileKeys});
    } catch (err) {
        return fail(res, 500, "Failed to create project", err);
    }
});

router.post("/:id", withAuth, async (req, res) => {
    const id = req.params.id;
    if (!UUID.test(id)) return fail(res, 404, "Project not found");
    const {name, projectJson, fileCount} = req.body ?? {};
    let json: unknown;
    try {
        json = parseProjectJson(projectJson);
    } catch (err) {
        return fail(res, 400, "projectJson is not valid JSON", err);
    }
    try {
        const updated = await updateProject({
            id,
            owner: currentUser(res).id,
            name: typeof name === "string" ? name : undefined,
            projectJson: json,
        });
        if (!updated) {
            return fail(res, 404, "Project not found");
        }
        const fileKeys = await createFilePlaceholders(id, Number(fileCount || 0));
        return res.status(200).json({project: updated, fileKeys});
    } catch (err) {
        return fail(res, 500, "Failed to update project", err);
    }
});

router.use("/:projectId/file", withAuth, requireOwnedProject, fileRoutes);

export default router;
