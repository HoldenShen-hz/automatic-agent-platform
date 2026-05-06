/**
 * Idempotency Key Enforcement Middleware
 *
 * Implements idempotency-key enforcement per §6.2 to prevent duplicate write operations.
 * All write operations (POST/PUT/PATCH/DELETE) must carry an idempotency key.
 * Duplicate keys within the TTL window return cached responses.
 *
 * Part of R18-30: No idempotency-key enforcement middleware
 */

import { AppError } from "../../../contracts/errors.js";
import {
  type IdempotencyStorage,
  type IdempotencyEntry,
  InMemoryIdempotencyStorage,
  createIdempotencyStorage,
} from "./idempotency-key-storage.js";

/**
 * HTTP methods that require idempotency key.
 */
export const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Idempotency key configuration.
 */
export interface IdempotencyKeyConfig {
  /** TTL for idempotency keys in milliseconds (default 24 hours) */
  ttlMs: number;
  /** Whether to require idempotency key for write operations */
  required: boolean;
  /** Whether to enable per-tenant idempotency key isolation */
  perTenant: boolean;
  /** Header name for idempotency key */
  headerName: string;
  /** Storage backend type */
  storageType: "memory" | "redis" | "sqlite";
}

/**
 * Default idempotency key configuration per §6.2.
 */
export const DEFAULT_IDEMPOTENCY_KEY_CONFIG: IdempotencyKeyConfig = {
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
  required: true,
  perTenant: true,
  headerName: "Idempotency-Key",
  storageType: "memory",
};

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
  /** Whether the original request with this key is still in flight */
  requestInFlight?: boolean;
}

/**
 * Idempotency Key Enforcement Middleware.
 *
 * Enforces idempotency key presence and deduplication for write operations.
 * Keys are stored with TTL and duplicate requests return cached responses.
 */
export class IdempotencyKeyMiddleware {
  private readonly config: IdempotencyKeyConfig;
  private readonly storage: IdempotencyStorage;

  constructor(config: Partial<IdempotencyKeyConfig> & { storage?: IdempotencyStorage } = {}) {
    this.config = { ...DEFAULT_IDEMPOTENCY_KEY_CONFIG, ...config };
    if (config.storage) {
      this.storage = config.storage;
    } else {
      this.storage = createIdempotencyStorage(this.config.storageType);
    }
  }

  /**
   * Generate a unique key for storing idempotency entries.
   */
  private generateStorageKey(idempotencyKey: string, tenantId?: string | null): string {
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
  public async check(options: {
    method: string;
    idempotencyKey?: string | null;
    tenantId?: string | null;
    body?: unknown;
  }): Promise<IdempotencyDecision> {
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
      const existing = await this.storage.get(storageKey);

      if (existing && Date.now() < existing.expiresAt) {
        // Check if the method matches first (same key with different method = conflict)
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

        if (existing.statusCode === 0) {
          return {
            allowed: true,
            isDuplicate: true,
            requestInFlight: true,
            error: {
              statusCode: 409,
              code: "api.idempotency_request_in_flight",
              message: `Idempotency-Key '${idempotencyKey}' is already processing another ${existing.method} request.`,
            },
          };
        }

        // Same method - return cached response
        let body: unknown;
        if (existing.responseBody != null) {
          try {
            body = JSON.parse(existing.responseBody);
          } catch {
            body = existing.responseBody;
          }
        } else {
          body = undefined;
        }

        return {
          allowed: true,
          isDuplicate: true,
          cachedResponse: {
            statusCode: existing.statusCode,
            body,
          },
        };
      }

      // New idempotency key or expired - store pending entry
      await this.storage.set(storageKey, {
        method,
        statusCode: 0, // Will be updated when request completes
        responseBody: null,
        requestHash: null,
      }, this.config.ttlMs);

      return { allowed: true, isDuplicate: false };
    }

    // Read operations don't need idempotency enforcement
    return { allowed: true, isDuplicate: false };
  }

  /**
   * Record the response for an idempotency key.
   * Should be called after the request completes to cache the response.
   */
  public async record(options: {
    method?: string;
    idempotencyKey: string;
    tenantId?: string | null;
    statusCode: number;
    responseBody: unknown;
  }): Promise<void> {
    const { method, idempotencyKey, tenantId, statusCode, responseBody } = options;
    const storageKey = this.generateStorageKey(idempotencyKey, tenantId);
    const existing = await this.storage.get(storageKey);
    let bodyStr: string | null = null;
    if (responseBody != null) {
      bodyStr = JSON.stringify(responseBody);
    }
    await this.storage.set(storageKey, {
      method: method ?? existing?.method ?? "POST",
      statusCode,
      responseBody: bodyStr,
      requestHash: null,
    }, this.config.ttlMs);
  }

  /**
   * Clear an idempotency key entry.
   */
  public async clear(idempotencyKey: string, tenantId?: string): Promise<void> {
    const storageKey = this.generateStorageKey(idempotencyKey, tenantId);
    await this.storage.delete(storageKey);
  }

  /**
   * Clean up expired entries.
   */
  public async cleanup(maxDelete?: number): Promise<number> {
    return this.storage.cleanup(maxDelete);
  }

  /**
   * Get the underlying storage instance.
   */
  public getStorage(): IdempotencyStorage {
    return this.storage;
  }

  /**
   * Clear all idempotency key entries.
   */
  public clearAll(): void {
    const storage = this.storage as InMemoryIdempotencyStorage;
    if (typeof storage.clear === "function") {
      storage.clear();
    }
  }

  /**
   * Get the current entry count.
   */
  public size(): number {
    const storage = this.storage as InMemoryIdempotencyStorage;
    if (typeof storage.size === "function") {
      return storage.size();
    }
    return 0;
  }
}

/**
 * Create an idempotency key middleware with the given configuration.
 */
export function createIdempotencyKeyMiddleware(
  config: Partial<IdempotencyKeyConfig> & { storage?: IdempotencyStorage } = {},
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
