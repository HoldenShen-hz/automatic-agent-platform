/**
 * Cache Error Definitions
 *
 * Custom error types for cache operations with specific error codes
 * for different failure scenarios.
 */
export class CacheError extends Error {
    code;
    retryable;
    constructor(message, code, retryable = false) {
        super(message);
        this.name = 'CacheError';
        this.code = code;
        this.retryable = retryable;
    }
}
export class CacheSerializationError extends CacheError {
    constructor(message = 'Failed to serialize cache value') {
        super(message, 'CACHE_SERIALIZATION_ERROR', false);
        this.name = 'CacheSerializationError';
    }
}
export class CachePolicyError extends CacheError {
    constructor(message = 'Invalid cache policy') {
        super(message, 'CACHE_POLICY_ERROR', false);
        this.name = 'CachePolicyError';
    }
}
export class CachePayloadTooLargeError extends CacheError {
    constructor(sizeBytes, maxBytes) {
        super(`Cache payload size ${sizeBytes} exceeds maximum ${maxBytes}`, 'CACHE_PAYLOAD_TOO_LARGE', false);
        this.name = 'CachePayloadTooLargeError';
    }
}
export class CacheNotFoundError extends CacheError {
    constructor(namespace, key) {
        super(`Cache entry not found: ${namespace}:${key}`, 'CACHE_NOT_FOUND', false);
        this.name = 'CacheNotFoundError';
    }
}
export class CacheExpiredError extends CacheError {
    constructor(namespace, key) {
        super(`Cache entry expired: ${namespace}:${key}`, 'CACHE_EXPIRED', false);
        this.name = 'CacheExpiredError';
    }
}
export class CacheVersionMismatchError extends CacheError {
    constructor(namespace, key, expected, actual) {
        super(`Cache version mismatch for ${namespace}:${key}: expected ${expected}, got ${actual}`, 'CACHE_VERSION_MISMATCH', false);
        this.name = 'CacheVersionMismatchError';
    }
}
export class CacheDisabledError extends CacheError {
    constructor(namespace) {
        super(`Cache is disabled for namespace: ${namespace}`, 'CACHE_DISABLED', false);
        this.name = 'CacheDisabledError';
    }
}
export class CacheInitializationError extends CacheError {
    constructor(message) {
        super(message, 'CACHE_INITIALIZATION_ERROR', false);
        this.name = 'CacheInitializationError';
    }
}
//# sourceMappingURL=cache-errors.js.map