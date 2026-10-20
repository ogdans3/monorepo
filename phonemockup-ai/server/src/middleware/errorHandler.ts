import {Request, Response, NextFunction} from "express";
import {logger} from "../logger.js";
import {describeError} from "../errors.js";

/**
 * The last stop for errors no route answered. Only an error marked as safe to
 * show (`expose`, which body-parser and http-errors set on 4xx) keeps its
 * status. A failure talking to Clerk is ours, not the caller's, so it is a 503
 * rather than a 401 or 404 that would read as "not signed in". Everything else
 * is a 500. Same shape as every route: {error: "message"}.
 */
export function errorHandler(
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {
    const clerk = err?.clerkError === true || err?.name === "ClerkAPIResponseError";
    const status = clerk ? 503 : err?.expose && Number.isInteger(err.status) ? err.status : 500;
    logger.error("Unhandled error", {status, error: describeError(err)});
    res.status(status).json({
        error: clerk
            ? "Sign-in is unavailable right now"
            : status === 500 ? "Internal Server Error" : err.message ?? "Error",
    });
}
