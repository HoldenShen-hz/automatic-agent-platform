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
export type AppErrorCategory =
  | "validation"    // Input validation failures
  | "policy"        // Policy rule violations
  | "auth"          // Authentication failures
  | "budget"        // Budget or quota exceeded
  | "provider"      // External AI provider errors
  | "tool"          // Tool execution failures
  | "sandbox"       // Sandbox security violations
  | "storage"       // Database or file storage errors
  | "workflow"      // Workflow state machine errors
  | "runtime"       // Runtime execution errors
  | "tenant"        // Multi-tenant boundary violations
  | "monetization"  // Billing and payment errors
  | "external"      // External service integration errors
  | "internal";     // Unclassified internal errors

/**
 * Error source indicates the primary system component that generated the error.
 * Used for error routing, debugging, and metrics attribution.
 */
export type AppErrorSource =
  | "gateway"    // API gateway or ingress layer
  | "runtime"    // Core runtime execution engine
  | "workflow"   // Workflow orchestration
  | "provider"   // AI model provider integration
  | "tool"       // Tool executor
  | "storage"    // Database or storage layer
  | "policy"     // Policy enforcement
  | "internal";  // Internal system component

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
export class AppError extends Error {
  /** Unique error code for programmatic error identification */
  public readonly code: ErrorCode;
  /** Error category for classification and routing */
  public readonly category: AppErrorCategory;
  /** Whether the operation that caused this error can be retried */
  public readonly retryable: boolean;
  /** User-facing message suitable for UI display */
  public readonly userMessage: string;
  /** Internal debugging information not exposed to users */
  public readonly internalDetails: Record<string, unknown> | null;
  /** System component that generated the error */
  public readonly source: AppErrorSource;
  /** Distributed trace identifier for request correlation */
  public readonly traceId: string | null;
  /** Associated task identifier */
  public readonly taskId: string | null;
  /** Associated execution identifier */
  public readonly executionId: string | null;
  /** Name of the error class that caused this error */
  public readonly causedBy: string | null;
  /** Timestamp when the error occurred */
  public readonly occurredAt: string;
  /** HTTP status code for API responses */
  public readonly statusCode: number;

  /**
   * Creates an AppError with the given code and message.
   * @param code - Error code for identification
   * @param message - Error message (technical, for logging)
   * @param options - Additional error context and configuration
   */
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(options.userMessage ?? message, options.cause != null ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.category = options.category ?? "internal";
    this.retryable = options.retryable ?? false;
    this.userMessage = options.userMessage ?? message;
    this.internalDetails = options.details ?? null;
    this.source = options.source ?? "internal";
    this.traceId = options.traceId ?? null;
    this.taskId = options.taskId ?? null;
    this.executionId = options.executionId ?? null;
    this.causedBy = options.causedBy ?? null;
    this.occurredAt = options.occurredAt ?? new Date().toISOString();
    this.statusCode = options.statusCode ?? 500;
  }

  /**
   * Returns the error code. Alias for 'code' for backward compatibility.
   */
  public get errorCode(): string {
    return this.code;
  }

  /**
   * Returns internal details for debugging. Undefined when null to exclude from JSON serialization.
   */
  public get details(): Record<string, unknown> | undefined {
    return this.internalDetails ?? undefined;
  }

  /**
   * Serializes the error to a JSON-serializable object.
   *
   * Purpose: Ensures consistent API error response format with both camelCase
   * and snake_case variants for compatibility with different clients.
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      errorCode: this.code,
      message: this.userMessage,
      userMessage: this.userMessage,
      user_message: this.userMessage,
      category: this.category,
      retryable: this.retryable,
      internalDetails: this.internalDetails,
      internal_details: this.internalDetails,
      source: this.source,
      traceId: this.traceId,
      trace_id: this.traceId,
      taskId: this.taskId,
      task_id: this.taskId,
      executionId: this.executionId,
      execution_id: this.executionId,
      causedBy: this.causedBy,
      caused_by: this.causedBy,
      occurredAt: this.occurredAt,
      occurred_at: this.occurredAt,
      statusCode: this.statusCode,
      cause: (this.cause as Error | undefined)?.message,
    };
  }

  /**
   * Wraps an arbitrary error in an AppError with classification.
   *
   * Purpose: Convert unknown errors (from external libraries, system errors, etc.)
   * into typed AppError instances while preserving the original error information.
   * If the error is already an AppError, it is returned unchanged.
   */
  public static wrap(
    error: unknown,
    code: ErrorCode,
    message: string,
    options: ErrorOptions = {},
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }
    const originalMessage = error instanceof Error ? error.message : String(error);
    return new AppError(code, message, {
      ...options,
      details: {
        originalError: originalMessage,
        ...(options.details ?? {}),
      },
      causedBy: options.causedBy ?? (error instanceof Error ? error.name : null),
    });
  }
}

/**
 * Error for input validation failures.
 * Default HTTP status: 400 Bad Request
 */
export class ValidationError extends AppError {
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(code, message, {
      ...options,
      category: options.category ?? "validation",
      source: options.source ?? "runtime",
      statusCode: options.statusCode ?? 400,
      retryable: options.retryable ?? false,
    });
    this.name = "ValidationError";
  }
}

/**
 * Error for policy rule violations.
 * Default HTTP status: 403 Forbidden
 */
export class PolicyDeniedError extends AppError {
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(code, message, {
      ...options,
      category: options.category ?? "policy",
      source: options.source ?? "policy",
      statusCode: options.statusCode ?? 403,
      retryable: options.retryable ?? false,
    });
    this.name = "PolicyDeniedError";
  }
}

/**
 * Error for authentication failures.
 * Default HTTP status: 401 Unauthorized
 */
export class AuthError extends AppError {
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(code, message, {
      ...options,
      category: options.category ?? "auth",
      source: options.source ?? "gateway",
      statusCode: options.statusCode ?? 401,
      retryable: options.retryable ?? false,
    });
    this.name = "AuthError";
  }
}

/**
 * Error for external AI provider failures.
 * Default HTTP status: 502 Bad Gateway, retryable by default
 */
export class ProviderError extends AppError {
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(code, message, {
      ...options,
      category: options.category ?? "provider",
      source: options.source ?? "provider",
      statusCode: options.statusCode ?? 502,
      retryable: options.retryable ?? true,
    });
    this.name = "ProviderError";
  }
}

/**
 * Error for tool execution failures.
 * Default HTTP status: 500 Internal Server Error
 */
export class ToolExecutionError extends AppError {
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(code, message, {
      ...options,
      category: options.category ?? "tool",
      source: options.source ?? "tool",
      statusCode: options.statusCode ?? 500,
      retryable: options.retryable ?? false,
    });
    this.name = "ToolExecutionError";
  }
}

/**
 * Error for sandbox security violations.
 * Default HTTP status: 403 Forbidden
 */
export class SandboxError extends AppError {
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(code, message, {
      ...options,
      category: options.category ?? "sandbox",
      source: options.source ?? "tool",
      statusCode: options.statusCode ?? 403,
      retryable: options.retryable ?? false,
    });
    this.name = "SandboxError";
  }
}

/**
 * Error for database or storage layer failures.
 * Default HTTP status: 500 Internal Server Error, retryable by default
 */
export class StorageError extends AppError {
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(code, message, {
      ...options,
      category: options.category ?? "storage",
      source: options.source ?? "storage",
      statusCode: options.statusCode ?? 500,
      retryable: options.retryable ?? true,
    });
    this.name = "StorageError";
  }
}

/**
 * Error for workflow state machine violations.
 * Default HTTP status: 409 Conflict
 */
export class WorkflowStateError extends AppError {
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(code, message, {
      ...options,
      category: options.category ?? "workflow",
      source: options.source ?? "workflow",
      statusCode: options.statusCode ?? 409,
      retryable: options.retryable ?? false,
    });
    this.name = "WorkflowStateError";
  }
}

/**
 * Error for multi-tenant boundary violations.
 * Default HTTP status: 403 Forbidden
 */
export class TenantBoundaryError extends AppError {
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(code, message, {
      ...options,
      category: options.category ?? "tenant",
      source: options.source ?? "policy",
      statusCode: options.statusCode ?? 403,
      retryable: options.retryable ?? false,
    });
    this.name = "TenantBoundaryError";
  }
}

/**
 * Error for billing and payment failures.
 * Default HTTP status: 402 Payment Required
 */
export class MonetizationError extends AppError {
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(code, message, {
      ...options,
      category: options.category ?? "monetization",
      source: options.source ?? "runtime",
      statusCode: options.statusCode ?? 402,
      retryable: options.retryable ?? false,
    });
    this.name = "MonetizationError";
  }
}

/**
 * Error for unclassified internal system failures.
 * Default HTTP status: 500 Internal Server Error
 */
export class InternalAppError extends AppError {
  public constructor(code: ErrorCode, message: string, options: ErrorOptions = {}) {
    super(code, message, {
      ...options,
      category: options.category ?? "internal",
      source: options.source ?? "internal",
      statusCode: options.statusCode ?? 500,
      retryable: options.retryable ?? false,
    });
    this.name = "InternalAppError";
  }
}

/**
 * Legacy locking error with E7-prefixed error code.
 * Indicates distributed lock acquisition failures or lock conflicts.
 */
export class LockingError extends StorageError {
  public constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(`E7${code}`, message, { statusCode: 409, details, retryable: true });
    this.name = "LockingError";
  }
}

/**
 * Legacy memory error with E8-prefixed error code.
 * Indicates failures in memory service or context management.
 */
export class MemoryError extends InternalAppError {
  public constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(`E8${code}`, message, { statusCode: 500, details, source: "runtime" });
    this.name = "MemoryError";
  }
}

/**
 * Legacy runtime error with EC-prefixed error code.
 * Indicates failures in core runtime execution engine.
 */
export class RuntimeError extends InternalAppError {
  public constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(`EC${code}`, message, { statusCode: 500, details, category: "runtime", source: "runtime" });
    this.name = "RuntimeError";
  }
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
export function createErrorCode(domain: string, code: number): string {
  return `E${domain}${code.toString().padStart(3, "0")}`;
}

/**
 * Type guard to check if an unknown value is an AppError instance.
 *
 * Purpose: Safely narrow unknown error types to AppError for type-safe
 * error handling without risking runtime exceptions.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Extracts the error code from an unknown error value.
 *
 * Purpose: Provide a safe way to get error codes from any error,
 * whether it's an AppError or an unknown error type. Returns a
 * fallback code for non-AppError errors.
 */
export function getErrorCode(error: unknown): string {
  if (isAppError(error)) {
    return error.code;
  }
  return "E0000";
}

/**
 * Normalizes an unknown error to an AppError instance.
 *
 * Purpose: Ensure consistent error handling by converting any error
 * (AppError, standard Error, or raw value) into an AppError with
 * a fallback code and message if the error cannot be classified.
 */
export function normalizeToAppError(
  error: unknown,
  fallback: {
    code: ErrorCode;
    message: string;
    options?: ErrorOptions;
  },
): AppError {
  if (error instanceof AppError) {
    return error;
  }
  return AppError.wrap(error, fallback.code, fallback.message, fallback.options);
}
