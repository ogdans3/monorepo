import express from "express";
import multer from "multer";
import {db} from "../db/client.js";
import {file as fileTable} from "../db/schema.js";
import {and, eq} from "drizzle-orm";
import {describeError} from "../errors.js";

const router = express.Router({mergeParams: true});

const B2_KEY_ID = process.env.B2_KEY_ID!;
const B2_APP_KEY = process.env.B2_APP_KEY!;
const B2_BUCKET_ID = process.env.B2_BUCKET_ID!;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME!;

type B2Auth = {
    apiUrl: string;
    authorizationToken: string;
    downloadUrl: string;
    expiresAt: number;
};

let cachedAuth: B2Auth | null = null;

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

function requestUploadUrl(auth: B2Auth) {
    return fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: "POST",
        headers: {Authorization: auth.authorizationToken, "Content-Type": "application/json"},
        body: JSON.stringify({bucketId: B2_BUCKET_ID}),
    });
}

/**
 * b2_get_upload_url. B2 can drop an account token before it would expire
 * (401 expired_auth_token or bad_auth_token); its docs say to authorize again,
 * so a 401 clears the cached token and asks once more. Without this every
 * upload failed until the 6-hour cache ran out.
 */
async function b2GetUploadUrl(): Promise<{auth: B2Auth; response: Response}> {
    let auth = await b2AuthorizeAccount();
    let response = await requestUploadUrl(auth);
    if (response.status === 401) {
        cachedAuth = null;
        auth = await b2AuthorizeAccount();
        response = await requestUploadUrl(auth);
    }
    return {auth, response};
}

/** Uploads are held in memory before going to B2, so they need a ceiling. */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A project's files are what goes on the phone's screen: pictures and
// recordings, nothing else.
const upload = multer({
    storage: multer.memoryStorage(),
    // Text fields are held in memory too and multer has no ceiling of its
    // own: one request with a few hundred large fields ran the API out of
    // heap. The form only carries fileKey (a uuid) besides the file.
    limits: {fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4, fieldSize: 1024, fieldNameSize: 100, parts: 6},
    fileFilter: (_req, file, done) => {
        done(null, file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/"));
    },
});

// Callers reach these routes through project.ts, which has already checked
// the session and that the user owns :projectId.

router.get("/", async (req, res) => {
    try {
        const projectId = (req.params as {projectId?: string}).projectId;
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
        console.error(500, req.method, req.originalUrl, describeError(err));
        return res.status(500).json({error: "Failed to list files"});
    }
});

/**
 * Parsing the upload is all this step does, so any error in it is the
 * request's: too big, too many files, or a body that was cut off or malformed.
 */
function receiveFile(req: express.Request, res: express.Response, next: express.NextFunction) {
    upload.single("file")(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
            const tooBig = (err as {code?: string}).code === "LIMIT_FILE_SIZE";
            return res.status(tooBig ? 413 : 400).json({
                error: tooBig ? "File is too large" : "Send fileKey and one file in the \"file\" field",
            });
        }
        if (err) {
            console.error(400, req.method, req.originalUrl, describeError(err));
            return res.status(400).json({error: "The upload was cut off or malformed"});
        }
        next();
    });
}

/**
 * Browsers send the file name as raw UTF-8, and multer reads it as latin1, so
 * "skjermbilde-æøå.png" arrives as "skjermbilde-Ã¦Ã¸Ã¥.png". A name with
 * characters beyond latin1 was decoded already and is kept as it is.
 */
export function utf8FileName(name: string): string {
    if (!/^[\x00-\xff]*$/.test(name)) return name;
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    return decoded.includes("\uFFFD") ? name : decoded;
}

/** Best effort: a file B2 holds that no row points to is only a cost. */
async function b2DeleteFileVersion(apiUrl: string, authorizationToken: string, fileName: string, fileId: string) {
    try {
        const res = await fetch(`${apiUrl}/b2api/v2/b2_delete_file_version`, {
            method: "POST",
            headers: {Authorization: authorizationToken, "Content-Type": "application/json"},
            body: JSON.stringify({fileName, fileId}),
        });
        if (!res.ok) console.error("b2_delete_file_version failed", res.status, await res.text().catch(() => ""));
    } catch (err) {
        console.error("b2_delete_file_version failed", describeError(err));
    }
}

router.post("/", receiveFile, async (req, res) => {
    try {
        const projectId = (req.params as {projectId?: string}).projectId;
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
        const {mimetype, size, buffer} = req.file;
        const originalname = utf8FileName(req.file.originalname);
        const safeContentType = mimetype || "application/octet-stream";
        /** An upload URL with its token; false once B2 or the network has failed. */
        async function uploadTarget() {
            let got;
            try {
                got = await b2GetUploadUrl();
            } catch (e: any) {
                console.error(502, req.method, req.originalUrl, "b2_authorize_account or b2_get_upload_url failed", e?.message);
                return false;
            }
            if (!got.response.ok) {
                const text = await got.response.text().catch(() => "");
                console.error(502, req.method, req.originalUrl, "b2_get_upload_url failed", text);
                return false;
            }
            const {uploadUrl, authorizationToken} = (await got.response.json()) as {
                uploadUrl: string;
                authorizationToken: string;
            };
            return {auth: got.auth, uploadUrl, uploadAuthToken: authorizationToken};
        }
        const sendTo = (target: {uploadUrl: string; uploadAuthToken: string}) =>
            fetch(target.uploadUrl, {
                method: "POST",
                headers: {
                    Authorization: target.uploadAuthToken,
                    "X-Bz-File-Name": encodeURIComponent(fileKey),
                    "Content-Type": safeContentType,
                    "X-Bz-Content-Sha1": "do_not_verify",
                    "X-Bz-Info-projectId": projectId,
                    "X-Bz-Info-originalName": encodeURIComponent(originalname),
                },
                body: new Uint8Array(buffer.buffer as ArrayBuffer, buffer.byteOffset, buffer.byteLength),
            });

        let target = await uploadTarget();
        if (!target) return res.status(502).json({error: "File storage is unavailable"});
        let uploadResp;
        try {
            uploadResp = await sendTo(target);
            // An upload URL can expire or its pod be busy; B2's docs say to
            // get a new one and try again.
            if (uploadResp.status === 401 || uploadResp.status === 503) {
                target = await uploadTarget();
                if (!target) return res.status(502).json({error: "File storage is unavailable"});
                uploadResp = await sendTo(target);
            }
        } catch {
            console.error(502, req.method, req.originalUrl, "Network error calling b2_upload_file");
            return res.status(502).json({error: "Network error calling b2_upload_file"});
        }
        const {apiUrl, authorizationToken, downloadUrl} = target.auth;
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
        try {
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
        } catch (err) {
            // B2 has the file but no row will point to it: remove it again.
            await b2DeleteFileVersion(apiUrl, authorizationToken, b2Result.fileName, b2Result.fileId);
            throw err;
        }
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
        console.error(500, req.method, req.originalUrl, describeError(err));
        return res.status(500).json({error: "Upload failed"});
    }
});

export default router;
