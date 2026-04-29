/**
 * Request Deduplication Middleware
 *
 * Implements request deduplication per §4.2 P1 to prevent duplicate request processing.
 * Uses a sliding window cache with request fingerprinting.
 */

import { nowIso } from "../../../platform/contracts/types/ids.js";

/**
 * Request fingerprint for deduplication.
 * Combines method, path, and optionally body hash.
 */
export interface RequestFingerprint {
  method: string;
  path: string;
  bodyHash: string | null;
  timestamp: number;
}

/**
 * Deduplication decision result.
 */
export interface DeduplicationDecision {
  allowed: boolean;
  isDuplicate: boolean;
  originalRequestId: string | null;
  retryAfterMs: number | null;
}

/**
 * Deduplication configuration.
 */
export interface DeduplicationConfig {
  /** Time window in milliseconds for deduplication */
  windowMs: number;
  /** Maximum fingerprints to track */
  maxFingerprints: number;
  /** Whether to consider request body in fingerprint */
  includeBody?: boolean;
  /** Whether to enable per-tenant deduplication */
  perTenant?: boolean;
}

/**
 * Tracks request fingerprints for deduplication.
 */
interface DeduplicationEntry {
  requestId: string;
  fingerprint: RequestFingerprint;
  expiresAt: number;
}

/**
 * Key for tracking deduplication (tenant:method:path or just method:path).
 */
type DeduplicationKey = string;

/**
 * Request Deduplication Middleware using sliding window cache.
 *
 * Tracks recent requests by fingerprint and detects duplicates within a time window.
 * Each key (tenant, or global) gets independent deduplication tracking.
 */
export class DeduplicationMiddleware {
  private readonly windowMs: number;
  private readonly maxFingerprints: number;
  private readonly includeBody: boolean;
  private readonly perTenant: boolean;
  private readonly entries = new Map<DeduplicationKey, DeduplicationEntry[]>();
  private requestCounter = 0;

  constructor(config: DeduplicationConfig) {
    this.windowMs = config.windowMs;
    this.maxFingerprints = config.maxFingerprints;
    this.includeBody = config.includeBody ?? false;
    this.perTenant = config.perTenant ?? false;
  }

  /**
   * Generates a fingerprint hash from request components.
   */
  public generateFingerprint(options: {
    method: string;
    path: string;
    body?: string;
    tenantId?: string;
  }): RequestFingerprint {
    const bodyHash = this.includeBody && options.body
      ? this.hashBody(options.body)
      : null;
    return {
      method: options.method.toUpperCase(),
      path: options.path,
      bodyHash,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if a request is a duplicate and should be allowed or blocked.
   *
   * @param key - Deduplication key (tenant:method:path or method:path)
   * @param fingerprint - Request fingerprint
   * @returns DeduplicationDecision with allowed status and metadata
   */
  public check(key: DeduplicationKey, fingerprint: RequestFingerprint): DeduplicationDecision {
    const now = Date.now();
    const entries = this.entries.get(key) ?? [];

    // Clean expired entries
    const validEntries = entries.filter((e) => e.expiresAt > now);

    // Check for duplicate
    const duplicate = validEntries.find((e) =>
      e.fingerprint.method === fingerprint.method &&
      e.fingerprint.path === fingerprint.path &&
      e.fingerprint.bodyHash === fingerprint.bodyHash,
    );

    if (duplicate != null) {
      const retryAfterMs = duplicate.expiresAt - now;
      return {
        allowed: false,
        isDuplicate: true,
        originalRequestId: duplicate.requestId,
        retryAfterMs: retryAfterMs > 0 ? retryAfterMs : null,
      };
    }

    // Add new entry
    const requestId = `req_${++this.requestCounter}_${now}`;
    const expiresAt = now + this.windowMs;
    validEntries.push({ requestId, fingerprint, expiresAt });

    // Trim if needed
    if (validEntries.length > this.maxFingerprints) {
      validEntries.sort((a, b) => a.expiresAt - b.expiresAt);
      validEntries.splice(0, validEntries.length - this.maxFingerprints);
    }

    this.entries.set(key, validEntries);

    return {
      allowed: true,
      isDuplicate: false,
      originalRequestId: null,
      retryAfterMs: null,
    };
  }

  /**
   * Generate a deduplication key from request context.
   */
  public generateKey(options: {
    tenantId?: string;
    method?: string;
    path?: string;
  }): DeduplicationKey {
    if (this.perTenant && options.tenantId) {
      return `tenant:${options.tenantId}`;
    }
    return "global";
  }

  /**
   * Clear all deduplication entries.
   */
  public clear(): void {
    this.entries.clear();
  }

  /**
   * Reset deduplication for a specific key.
   */
  public reset(key: DeduplicationKey): void {
    this.entries.delete(key);
  }

  /**
   * Simple hash function for request body.
   */
  private hashBody(body: string): string {
    let hash = 0;
    for (let i = 0; i < body.length; i++) {
      const char = body.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
}

/**
 * Default deduplication configuration per §4.2 P1.
 */
export const DEFAULT_DEDUPLICATION_CONFIG: DeduplicationConfig = {
  windowMs: 60_000, // 1 minute
  maxFingerprints: 10_000,
  includeBody: true,
  perTenant: true,
};

/**
 * Creates a deduplication middleware with the given configuration.
 */
export function createDeduplicationMiddleware(config: Partial<DeduplicationConfig> = {}): DeduplicationMiddleware {
  return new DeduplicationMiddleware({ ...DEFAULT_DEDUPLICATION_CONFIG, ...config });
}

/**
 * Global deduplication middleware instance.
 */
let globalDeduplicationMiddleware: DeduplicationMiddleware | null = null;

/**
 * Get or create the global deduplication middleware.
 */
export function getGlobalDeduplicationMiddleware(): DeduplicationMiddleware {
  if (!globalDeduplicationMiddleware) {
    globalDeduplicationMiddleware = createDeduplicationMiddleware();
  }
  return globalDeduplicationMiddleware;
}

/**
 * Reset the global deduplication middleware.
 */
export function resetGlobalDeduplicationMiddleware(): void {
  globalDeduplicationMiddleware = null;
}