/**
 * Idempotency Key Enforcement Middleware
 *
 * Implements idempotency-key enforcement per §6.2 to prevent duplicate write operations.
 * All write operations (POST/PUT/PATCH/DELETE) must carry an idempotency key.
 * Duplicate keys within the TTL window return 409 Conflict.
 */

import { AppError } from "../../../contracts/errors.js";

/**
 * HTTP methods that require idempotency key.
 */
export const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Idempotency key configuration.
 */
export interface IdempotencyKeyConfig {
  /** TTL for idempotency keys in milliseconds */
  ttlMs: number;
  /** Whether to require idempotency key for write operations */
  required: boolean;
  /** Whether to enable per-tenant idempotency key isolation */
  perTenant: boolean;
  /** Header name for idempotency key */
  headerName: string;
}

/**
 * Default idempotency key configuration per §6.2.
 */
export const DEFAULT_IDEMPOTENCY_KEY_CONFIG: IdempotencyKeyConfig = {
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
  required: true,
  perTenant: true,
  headerName: "Idempotency-Key",
};

/**
 * Idempotency key entry stored in cache.
 */
interface IdempotencyEntry {
  /** Request method that created this key */
  method: string;
  /** Response status code */
  statusCode: number;
  /** Cached response body */
  responseBody: unknown;
  /** When this entry expires */
  expiresAt: number;
  /** Tenant ID if per-tenant isolation is enabled */
  tenantId?: string;
}

/**
 * Idempotency key enforcement decision.
 */
export interface IdempotencyDecision {
  /** Whether the request is allowed to proceed */
  allowed: boolean;
  /** Whether this is a duplicate request */
  isDuplicate: boolean;
  /** Error details if not allowed */
  error?: {
    statusCode: number;
    code: string;
    message: string;
  };
  /** Cached response for duplicate requests */
  cachedResponse?: {
    statusCode: number;
    body: unknown;
  };
}

/**
 * Idempotency Key Enforcement Middleware.
 *
 * Enforces idempotency key presence and deduplication for write operations.
 * Keys are stored with TTL and duplicate requests return cached responses.
 */
export class IdempotencyKeyMiddleware {
  private readonly config: IdempotencyKeyConfig;
  private readonly entries = new Map<string, IdempotencyEntry>();
  private requestCounter = 0;

  constructor(config: Partial<IdempotencyKeyConfig> = {}) {
    this.config = { ...DEFAULT_IDEMPOTENCY_KEY_CONFIG, ...config };
  }

  /**
   * Generate a unique key for storing idempotency entries.
   */
  private generateStorageKey(idempotencyKey: string, tenantId?: string): string {
    if (this.config.perTenant && tenantId) {
      return `tenant:${tenantId}:${idempotencyKey}`;
    }
    return `global:${idempotencyKey}`;
  }

  /**
   * Check if a request requires idempotency key enforcement.
   */
  public isWriteOperation(method: string): boolean {
    return WRITE_METHODS.has(method.toUpperCase());
  }

  /**
   * Check and enforce idempotency key for a request.
   *
   * @param options - Request options
   * @returns IdempotencyDecision with allowed status and cached response if duplicate
   */
  public check(options: {
    method: string;
    idempotencyKey?: string;
    tenantId?: string;
    body?: unknown;
  }): IdempotencyDecision {
    const { method, idempotencyKey, tenantId } = options;
    const isWriteOp = this.isWriteOperation(method);

    // For write operations, enforce idempotency key
    if (isWriteOp) {
      // Check if idempotency key is required and present
      if (this.config.required && !idempotencyKey) {
        return {
          allowed: false,
          isDuplicate: false,
          error: {
            statusCode: 400,
            code: "api.idempotency_key_required",
            message: `Idempotency-Key header is required for ${method} requests.`,
          },
        };
      }

      if (!idempotencyKey) {
        // Key not required and not provided - allow the request
        return { allowed: true, isDuplicate: false };
      }

      // Check for duplicate idempotency key
      const storageKey = this.generateStorageKey(idempotencyKey, tenantId);
      const now = Date.now();
      const existing = this.entries.get(storageKey);

      if (existing && now < existing.expiresAt) {
        // Check if the method matches (same key with different method = conflict)
        if (existing.method !== method) {
          return {
            allowed: false,
            isDuplicate: true,
            error: {
              statusCode: 409,
              code: "api.idempotency_key_conflict",
              message: `Idempotency-Key '${idempotencyKey}' was already used for a ${existing.method} request.`,
            },
          };
        }

        // Same method - return cached response
        return {
          allowed: true,
          isDuplicate: true,
          cachedResponse: {
            statusCode: existing.statusCode,
            body: existing.responseBody,
          },
        };
      }

      // New idempotency key or expired - store pending entry
      const expiresAt = now + this.config.ttlMs;
      this.entries.set(storageKey, {
        method,
        statusCode: 0, // Will be updated when request completes
        responseBody: undefined,
        expiresAt,
        tenantId,
      });

      return { allowed: true, isDuplicate: false };
    }

    // Read operations don't need idempotency enforcement
    return { allowed: true, isDuplicate: false };
  }

  /**
   * Record the response for an idempotency key.
   * Should be called after the request completes to cache the response.
   */
  public record(options: {
    idempotencyKey: string;
    tenantId?: string;
    statusCode: number;
    responseBody: unknown;
  }): void {
    const { idempotencyKey, tenantId, statusCode, responseBody } = options;
    const storageKey = this.generateStorageKey(idempotencyKey, tenantId);
    const existing = this.entries.get(storageKey);

    if (existing) {
      existing.statusCode = statusCode;
      existing.responseBody = responseBody;
    }
  }

  /**
   * Clear an idempotency key entry.
   */
  public clear(idempotencyKey: string, tenantId?: string): void {
    const storageKey = this.generateStorageKey(idempotencyKey, tenantId);
    this.entries.delete(storageKey);
  }

  /**
   * Clean up expired entries.
   */
  public cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.entries.forEach((entry, key) => {
      if (now >= entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      this.entries.delete(key);
    }
  }

  /**
   * Clear all entries.
   */
  public clearAll(): void {
    this.entries.clear();
  }

  /**
   * Get the current number of tracked idempotency keys.
   */
  public size(): number {
    return this.entries.size;
  }
}

/**
 * Create an idempotency key middleware with the given configuration.
 */
export function createIdempotencyKeyMiddleware(
  config: Partial<IdempotencyKeyConfig> = {},
): IdempotencyKeyMiddleware {
  return new IdempotencyKeyMiddleware(config);
}

/**
 * Global idempotency key middleware instance.
 */
let globalIdempotencyKeyMiddleware: IdempotencyKeyMiddleware | null = null;

/**
 * Get or create the global idempotency key middleware.
 */
export function getGlobalIdempotencyKeyMiddleware(): IdempotencyKeyMiddleware {
  if (!globalIdempotencyKeyMiddleware) {
    globalIdempotencyKeyMiddleware = createIdempotencyKeyMiddleware();
  }
  return globalIdempotencyKeyMiddleware;
}

/**
 * Reset the global idempotency key middleware.
 */
export function resetGlobalIdempotencyKeyMiddleware(): void {
  globalIdempotencyKeyMiddleware = null;
}

/**
 * Middleware function to extract idempotency key from headers.
 */
export function extractIdempotencyKey(
  headers: Record<string, string | string[] | undefined>,
  headerName: string = "Idempotency-Key",
): string | undefined {
  const value = headers[headerName.toLowerCase()] ?? headers[headerName];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Build idempotency error response.
 */
export function buildIdempotencyErrorResponse(
  code: string,
  message: string,
  statusCode: number = 400,
): AppError {
  return new AppError(code, message, {
    statusCode,
    category: "validation",
    source: "runtime",
    retryable: false,
  });
}
