/**
 * Unified AppError Model
 *
 * Purpose: Provides a consistent error representation across the entire application.
 * All errors flowing through the system should be represented as AppError or its subclasses.
 * This ensures uniform error handling, logging, and API response formatting.
 *
 * @see docs_zh/contracts/app_error_contract.md
 */
/**
 * Error category classification used for routing, monitoring, and response handling.
 * Categories indicate the domain layer where the error originated.
 */
export type AppErrorCategory = "validation" | "policy" | "auth" | "budget" | "provider" | "tool" | "sandbox" | "storage" | "workflow" | "runtime" | "tenant" | "monetization" | "external" | "internal";
/**
 * Error source indicates the primary system component that generated the error.
 * Used for error routing, debugging, and metrics attribution.
 */
export type AppErrorSource = "gateway" | "runtime" | "workflow" | "provider" | "tool" | "storage" | "policy" | "internal";
/**
 * Error code string for programmatic error identification.
 * Format varies by error class: AppError uses freeform codes, legacy errors use E-prefixed codes.
 */
export type ErrorCode = string;
/**
 * Options for constructing an AppError instance.
 * All fields are optional with sensible defaults.
 */
export interface ErrorOptions {
    /** HTTP status code for API responses (default: 500) */
    statusCode?: number;
    /** Whether the operation can be safely retried (default: false) */
    retryable?: boolean;
    /** Additional structured data for debugging and logging */
    details?: Record<string, unknown> | null | undefined;
    /** The underlying error that caused this error */
    cause?: Error;
    /** Error category for classification (default: "internal") */
    category?: AppErrorCategory;
    /** System component that generated the error (default: "internal") */
    source?: AppErrorSource;
    /** Distributed trace identifier for request correlation */
    traceId?: string | null;
    /** Associated task identifier if error is task-scoped */
    taskId?: string | null;
    /** Associated execution identifier if error is execution-scoped */
    executionId?: string | null;
    /** Name of the error class or component that caused this error */
    causedBy?: string | null;
    /** Timestamp when the error occurred (ISO 8601, default: now) */
    occurredAt?: string;
    /** User-facing error message for UI display (default: same as message) */
    userMessage?: string;
}
/**
 * Base application error class.
 *
 * Purpose: Unified error representation that carries classification, context,
 * and presentation metadata through the system. Serializable to JSON for API responses.
 */
export declare class AppError extends Error {
    /** Unique error code for programmatic error identification */
    readonly code: ErrorCode;
    /** Error category for classification and routing */
    readonly category: AppErrorCategory;
    /** Whether the operation that caused this error can be retried */
    readonly retryable: boolean;
    /** User-facing message suitable for UI display */
    readonly userMessage: string;
    /** Internal debugging information not exposed to users */
    readonly internalDetails: Record<string, unknown> | null;
    /** System component that generated the error */
    readonly source: AppErrorSource;
    /** Distributed trace identifier for request correlation */
    readonly traceId: string | null;
    /** Associated task identifier */
    readonly taskId: string | null;
    /** Associated execution identifier */
    readonly executionId: string | null;
    /** Name of the error class that caused this error */
    readonly causedBy: string | null;
    /** Timestamp when the error occurred */
    readonly occurredAt: string;
    /** HTTP status code for API responses */
    readonly statusCode: number;
    /**
     * Creates an AppError with the given code and message.
     * @param code - Error code for identification
     * @param message - Error message (technical, for logging)
     * @param options - Additional error context and configuration
     */
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
    /**
     * Returns the error code. Alias for 'code' for backward compatibility.
     */
    get errorCode(): string;
    /**
     * Returns internal details for debugging. Undefined when null to exclude from JSON serialization.
     */
    get details(): Record<string, unknown> | undefined;
    /**
     * Serializes the error to a JSON-serializable object.
     *
     * Purpose: Ensures consistent API error response format with both camelCase
     * and snake_case variants for compatibility with different clients.
     */
    toJSON(): Record<string, unknown>;
    /**
     * Wraps an arbitrary error in an AppError with classification.
     *
     * Purpose: Convert unknown errors (from external libraries, system errors, etc.)
     * into typed AppError instances while preserving the original error information.
     * If the error is already an AppError, it is returned unchanged.
     */
    static wrap(error: unknown, code: ErrorCode, message: string, options?: ErrorOptions): AppError;
}
/**
 * Error for input validation failures.
 * Default HTTP status: 400 Bad Request
 */
export declare class ValidationError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for policy rule violations.
 * Default HTTP status: 403 Forbidden
 */
export declare class PolicyDeniedError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for authentication failures.
 * Default HTTP status: 401 Unauthorized
 */
export declare class AuthError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for external AI provider failures.
 * Default HTTP status: 502 Bad Gateway, retryable by default
 */
export declare class ProviderError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for tool execution failures.
 * Default HTTP status: 500 Internal Server Error
 */
export declare class ToolExecutionError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for sandbox security violations.
 * Default HTTP status: 403 Forbidden
 */
export declare class SandboxError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for database or storage layer failures.
 * Default HTTP status: 500 Internal Server Error, retryable by default
 */
export declare class StorageError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for workflow state machine violations.
 * Default HTTP status: 409 Conflict
 */
export declare class WorkflowStateError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for multi-tenant boundary violations.
 * Default HTTP status: 403 Forbidden
 */
export declare class TenantBoundaryError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for transient external service failures (e.g., network timeouts, temporary API outages).
 * These errors are retryable because the underlying issue may resolve on its own.
 * Default HTTP status: 502 Bad Gateway, retryable by default
 */
export declare class TransientExternalError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for permanent external service failures (e.g., invalid API keys, rate limit exceeded with no recovery path).
 * These errors are NOT retryable because retrying will not resolve the issue.
 * Default HTTP status: 502 Bad Gateway, NOT retryable
 */
export declare class PermanentExternalError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for billing and payment failures.
 * Default HTTP status: 402 Payment Required
 */
export declare class MonetizationError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Error for unclassified internal system failures.
 * Default HTTP status: 500 Internal Server Error
 */
export declare class InternalAppError extends AppError {
    constructor(code: ErrorCode, message: string, options?: ErrorOptions);
}
/**
 * Legacy locking error with E7-prefixed error code.
 * Indicates distributed lock acquisition failures or lock conflicts.
 */
export declare class LockingError extends StorageError {
    constructor(code: string, message: string, details?: Record<string, unknown>);
}
/**
 * Legacy memory error with E8-prefixed error code.
 * Indicates failures in memory service or context management.
 */
export declare class MemoryError extends InternalAppError {
    constructor(code: string, message: string, details?: Record<string, unknown>);
}
/**
 * Legacy runtime error with EC-prefixed error code.
 * Indicates failures in core runtime execution engine.
 */
export declare class RuntimeError extends InternalAppError {
    constructor(code: string, message: string, details?: Record<string, unknown>);
}
/**
 * Creates a standardized legacy error code with E-prefixed format.
 *
 * Purpose: Generate consistent error codes for the legacy error classes.
 * Format: E{domain}{3-digit code}, e.g., E001, E2AB, E4FF.
 *
 * @param domain - Single character or string representing the error domain
 * @param code - Numeric code to encode
 * @returns Formatted error code string
 */
export declare function createErrorCode(domain: string, code: number): string;
/**
 * Type guard to check if an unknown value is an AppError instance.
 *
 * Purpose: Safely narrow unknown error types to AppError for type-safe
 * error handling without risking runtime exceptions.
 */
export declare function isAppError(error: unknown): error is AppError;
/**
 * Extracts the error code from an unknown error value.
 *
 * Purpose: Provide a safe way to get error codes from any error,
 * whether it's an AppError or an unknown error type. Returns a
 * fallback code for non-AppError errors.
 */
export declare function getErrorCode(error: unknown): string;
/**
 * Normalizes an unknown error to an AppError instance.
 *
 * Purpose: Ensure consistent error handling by converting any error
 * (AppError, standard Error, or raw value) into an AppError with
 * a fallback code and message if the error cannot be classified.
 */
export declare function normalizeToAppError(error: unknown, fallback: {
    code: ErrorCode;
    message: string;
    options?: ErrorOptions;
}): AppError;
