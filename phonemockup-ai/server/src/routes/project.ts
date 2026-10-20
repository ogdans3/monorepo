import {Router, type NextFunction, type Request, type Response} from "express";
import fileRoutes from "./file.js";
import {currentUser, withAuth} from "../middleware/auth.js";
import {
    createProjectWithFiles,
    getProject,
    getProjects,
    updateProjectWithFiles,
} from "../db/queries.js";
import {describeError} from "../errors.js";

const router = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Longest project name the API keeps. */
const MAX_NAME_LENGTH = 200;

function validName(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_NAME_LENGTH;
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
    console.error(status, message, err === undefined ? "" : describeError(err));
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
        const limit = req.query.limit === undefined ? undefined : Number(req.query.limit);
        if (limit !== undefined && !(Number.isInteger(limit) && limit >= 1 && limit <= 200)) {
            return fail(res, 400, "limit must be a whole number from 1 to 200");
        }
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
    if (!validName(name)) {
        return fail(res, 400, `name is required, at most ${MAX_NAME_LENGTH} characters`);
    }
    let json: unknown;
    try {
        json = parseProjectJson(projectJson);
    } catch (err) {
        return fail(res, 400, "projectJson is not valid JSON", err);
    }
    try {
        const {project, fileKeys} = await createProjectWithFiles({
            owner: currentUser(res).id,
            name,
            projectJson: json,
            fileCount: Number(fileCount || 0),
        });
        return res.status(201).json({project, fileKeys});
    } catch (err) {
        return fail(res, 500, "Failed to create project", err);
    }
});

router.post("/:id", withAuth, async (req, res) => {
    const id = req.params.id;
    if (!UUID.test(id)) return fail(res, 404, "Project not found");
    const {name, projectJson, fileCount} = req.body ?? {};
    if (name !== undefined && !validName(name)) {
        return fail(res, 400, `name must not be empty, and at most ${MAX_NAME_LENGTH} characters`);
    }
    let json: unknown;
    try {
        json = parseProjectJson(projectJson);
    } catch (err) {
        return fail(res, 400, "projectJson is not valid JSON", err);
    }
    try {
        const saved = await updateProjectWithFiles({
            id,
            owner: currentUser(res).id,
            name,
            projectJson: json,
            fileCount: Number(fileCount || 0),
        });
        if (!saved) {
            return fail(res, 404, "Project not found");
        }
        return res.status(200).json(saved);
    } catch (err) {
        return fail(res, 500, "Failed to update project", err);
    }
});

router.use("/:projectId/file", withAuth, requireOwnedProject, fileRoutes);

export default router;
