import express from "express";
import fetch from "node-fetch";
import multer from "multer";
import {db} from "../db/client";
import {file as fileTable} from "../db/schema";
import {and, eq} from "drizzle-orm";

const router = express.Router({mergeParams: true});

const B2_KEY_ID = process.env.B2_KEY_ID!;
const B2_APP_KEY = process.env.B2_APP_KEY!;
const B2_BUCKET_ID = process.env.B2_BUCKET_ID!;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME!;

let cachedAuth:
    | {
    apiUrl: string;
    authorizationToken: string;
    downloadUrl: string;
    expiresAt: number;
}
    | null = null;

async function b2AuthorizeAccount() {
    if (cachedAuth && cachedAuth.expiresAt > Date.now() + 60000) {
        return cachedAuth;
    }
    const res = await fetch(
        "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
        {
            headers: {
                Authorization:
                    "Basic " +
                    Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString("base64"),
            },
        }
    );
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`b2_authorize_account failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
        apiUrl: string;
        authorizationToken: string;
        downloadUrl: string;
    };
    cachedAuth = {
        apiUrl: data.apiUrl,
        authorizationToken: data.authorizationToken,
        downloadUrl: data.downloadUrl,
        expiresAt: Date.now() + 6 * 60 * 60 * 1000,
    };
    return cachedAuth;
}

/** Uploads are held in memory before going to B2, so they need a ceiling. */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A project's files are what goes on the phone's screen: pictures and
// recordings, nothing else.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {fileSize: MAX_UPLOAD_BYTES, files: 1},
    fileFilter: (_req, file, done) => {
        done(null, file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/"));
    },
});

// Callers reach these routes through project.ts, which has already checked
// the session and that the user owns :projectId.

router.get("/", async (req, res) => {
    try {
        const projectId = req.params.projectId;
        if (!projectId) {
            console.error(400, req.method, req.originalUrl, "projectId is required in path");
            return res.status(400).json({error: "projectId is required in path"});
        }
        const rows = await db
            .select({
                id: fileTable.id,
                projectId: fileTable.projectId,
                fileType: fileTable.fileType,
                url: fileTable.url,
                fileName: fileTable.fileName,
                sizeBytes: fileTable.sizeBytes,
                storageProvider: fileTable.storageProvider,
            })
            .from(fileTable)
            .where(eq(fileTable.projectId, projectId));
        return res.status(200).json(rows);
    } catch (err: any) {
        console.error(500, req.method, req.originalUrl, err?.message);
        return res.status(500).json({error: "Failed to list files"});
    }
});

/** multer's own errors (too big, too many) are the client's fault, not a 500. */
function receiveFile(req: express.Request, res: express.Response, next: express.NextFunction) {
    upload.single("file")(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
            const tooBig = (err as {code?: string}).code === "LIMIT_FILE_SIZE";
            return res.status(tooBig ? 413 : 400).json({
                error: tooBig ? "File is too large" : "Send one file in the \"file\" field",
            });
        }
        if (err) return next(err);
        next();
    });
}

router.post("/", receiveFile, async (req, res) => {
    try {
        const projectId = req.params.projectId;
        if (!projectId) {
            console.error(400, req.method, req.originalUrl, "projectId is required in path");
            return res.status(400).json({error: "projectId is required in path"});
        }
        if (!req.file) {
            console.error(400, req.method, req.originalUrl, "No file uploaded");
            return res.status(400).json({error: "No image or video file uploaded"});
        }
        const fileKey = req.body?.fileKey;
        if (!fileKey) {
            console.error(400, req.method, req.originalUrl, "fileKey is required");
            return res.status(400).json({error: "fileKey is required"});
        }
        if (!UUID.test(String(fileKey))) {
            return res.status(404).json({error: "Invalid fileKey"});
        }
        const existing = await db
            .select({id: fileTable.id})
            .from(fileTable)
            .where(and(eq(fileTable.id, fileKey), eq(fileTable.projectId, projectId)))
            .limit(1);
        if (!existing.length) {
            console.error(404, req.method, req.originalUrl, "Invalid fileKey");
            return res.status(404).json({error: "Invalid fileKey"});
        }
        const {originalname, mimetype, size, buffer} = req.file;
        const safeContentType = mimetype || "application/octet-stream";
        let apiUrl: string;
        let authorizationToken: string;
        let downloadUrl: string;
        try {
            const auth = await b2AuthorizeAccount();
            apiUrl = auth.apiUrl;
            authorizationToken = auth.authorizationToken;
            downloadUrl = auth.downloadUrl;
        } catch (e: any) {
            console.error(502, req.method, req.originalUrl, "b2_authorize_account failed", e?.message);
            return res.status(502).json({error: "File storage is unavailable"});
        }
        let getUrlResp;
        try {
            getUrlResp = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
                method: "POST",
                headers: {
                    Authorization: authorizationToken,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({bucketId: B2_BUCKET_ID}),
            });
        } catch {
            console.error(502, req.method, req.originalUrl, "Network error calling b2_get_upload_url");
            return res.status(502).json({
                error: "Network error calling b2_get_upload_url",
            });
        }
        if (!getUrlResp.ok) {
            const text = await getUrlResp.text().catch(() => "");
            console.error(502, req.method, req.originalUrl, "b2_get_upload_url failed", text);
            return res.status(502).json({error: "File storage is unavailable"});
        }
        const {uploadUrl, authorizationToken: uploadAuthToken} = (await getUrlResp.json()) as {
            uploadUrl: string;
            authorizationToken: string;
        };
        let uploadResp;
        try {
            uploadResp = await fetch(uploadUrl, {
                method: "POST",
                headers: {
                    Authorization: uploadAuthToken,
                    "X-Bz-File-Name": encodeURIComponent(fileKey),
                    "Content-Type": safeContentType,
                    "X-Bz-Content-Sha1": "do_not_verify",
                    "X-Bz-Info-projectId": projectId,
                    "X-Bz-Info-originalName": encodeURIComponent(originalname),
                },
                body: buffer,
            });
        } catch {
            console.error(502, req.method, req.originalUrl, "Network error calling b2_upload_file");
            return res.status(502).json({error: "Network error calling b2_upload_file"});
        }
        if (!uploadResp.ok) {
            const text = await uploadResp.text().catch(() => "");
            console.error(uploadResp.status, req.method, req.originalUrl, "b2_upload_file failed", text);
            return res.status(502).json({error: "Upload to file storage failed"});
        }
        const b2Result = (await uploadResp.json()) as {
            fileId: string;
            fileName: string;
            contentSha1: string;
            contentType: string;
            contentLength: number;
            uploadTimestamp: number;
        };
        const urlForApp = B2_BUCKET_NAME
            ? `${downloadUrl}/file/${encodeURIComponent(B2_BUCKET_NAME)}/${encodeURIComponent(fileKey)}`
            : `b2://${b2Result.fileId}`;
        await db
            .update(fileTable)
            .set({
                url: urlForApp,
                fileType: safeContentType,
                sizeBytes: size,
                fileName: originalname,
                storageProvider: "backblaze_b2",
            })
            .where(eq(fileTable.id, fileKey));
        const finalRow = {
            id: fileKey,
            projectId,
            fileType: safeContentType,
            url: urlForApp,
            fileName: originalname,
            sizeBytes: size,
            storageProvider: "backblaze_b2",
        };
        return res.status(201).json({
            file: finalRow,
            b2: {
                fileId: b2Result.fileId,
                fileName: b2Result.fileName,
                contentType: b2Result.contentType,
                contentSha1: b2Result.contentSha1,
                contentLength: b2Result.contentLength,
                uploadTimestamp: b2Result.uploadTimestamp,
            },
            publicUrl: B2_BUCKET_NAME ? urlForApp : undefined,
        });
    } catch (err: any) {
        console.error(500, req.method, req.originalUrl, err?.message);
        return res.status(500).json({error: "Upload failed"});
    }
});

export default router;