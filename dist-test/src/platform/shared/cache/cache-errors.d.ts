/**
 * Cache Error Definitions
 *
 * Custom error types for cache operations with specific error codes
 * for different failure scenarios.
 */
export declare class CacheError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    constructor(message: string, code: string, retryable?: boolean);
}
export declare class CacheSerializationError extends CacheError {
    constructor(message?: string);
}
export declare class CachePolicyError extends CacheError {
    constructor(message?: string);
}
export declare class CachePayloadTooLargeError extends CacheError {
    constructor(sizeBytes: number, maxBytes: number);
}
export declare class CacheNotFoundError extends CacheError {
    constructor(namespace: string, key: string);
}
export declare class CacheExpiredError extends CacheError {
    constructor(namespace: string, key: string);
}
export declare class CacheVersionMismatchError extends CacheError {
    constructor(namespace: string, key: string, expected: string, actual: string);
}
export declare class CacheDisabledError extends CacheError {
    constructor(namespace: string);
}
export declare class CacheInitializationError extends CacheError {
    constructor(message: string);
}
