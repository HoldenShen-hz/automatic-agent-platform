/**
 * @fileoverview HTTP API error class and error normalization.
 *
 * Extracted from http-api-server.ts as part of GAP24A-02 deep split.
 */
import { AppError, type AppErrorCategory, type AppErrorSource } from "../../../contracts/errors.js";
export declare class ApiError extends AppError {
    constructor(statusCode: number, code: string, message: string);
}
export declare function inferApiErrorCategory(statusCode: number, code: string): AppErrorCategory;
export declare function inferApiErrorSource(code: string): AppErrorSource;
export declare function normalizeError(error: unknown): AppError;
