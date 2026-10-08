import {Request, Response, NextFunction} from "express";
import {logger} from "../logger";

export function errorHandler(
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {

    const status = err.status ?? 500;
    logger.error("Unhandled error", {status, err});
    res.status(status).json({
        error: {
            message:
                status === 500 ? "Internal Server Error" : err.message ?? "Error",
        },
    });
}