/**
 * Request Deduplication Middleware
 *
 * Implements request deduplication per §4.2 P1 to prevent duplicate request processing.
 * Uses a sliding window cache with request fingerprinting.
 */

import { createHash } from "node:crypto";
import {
  createGlobalSingletonSlot,
  getOrCreateGlobalSingleton,
  resetGlobalSingleton,
} from "../../../shared/lifecycle/global-singleton.js";

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
  /** Whether this middleware is running in a production-like environment */
  isProduction?: boolean;
  /** Explicitly allow process-local memory storage in production-like deployments */
  allowInMemoryInProduction?: boolean;
}

/**
 * Tracks request fingerprints for deduplication.
 */
interface DeduplicationEntry {
  requestId: string;
  fingerprint: RequestFingerprint;
  expiresAt: number;
}

interface DeduplicationBucket {
  entries: DeduplicationEntry[];
  earliestExpiry: number;
}

interface ExpiryHeapEntry {
  key: DeduplicationKey;
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
  private readonly entries = new Map<DeduplicationKey, DeduplicationBucket>();
  private readonly expiryHeap: ExpiryHeapEntry[] = [];
  private readonly maxBuckets: number;
  private requestCounter = 0;

  constructor(config: DeduplicationConfig) {
    if (config.isProduction === true && config.allowInMemoryInProduction !== true) {
      throw new Error("request_deduplication.distributed_store_required_in_production");
    }
    this.windowMs = config.windowMs;
    this.maxFingerprints = config.maxFingerprints;
    this.includeBody = config.includeBody ?? false;
    this.perTenant = config.perTenant ?? false;
    this.maxBuckets = Math.max(1, Math.trunc(config.maxFingerprints));
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
    this.evictExpiredBuckets(now);
    const bucket = this.entries.get(key);
    const entries = bucket?.entries ?? [];

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

    this.setBucket(key, validEntries);
    this.enforceBucketLimit();

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
    const method = (options.method ?? "*").toUpperCase();
    const path = options.path ?? "*";
    if (this.perTenant && options.tenantId) {
      return `tenant:${options.tenantId}:${method}:${path}`;
    }
    return `global:${method}:${path}`;
  }

  /**
   * Clear all deduplication entries.
   */
  public clear(): void {
    this.entries.clear();
    this.expiryHeap.length = 0;
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
    return createHash("sha256").update(body, "utf8").digest("hex");
  }

  private evictExpiredBuckets(now: number): void {
    while (this.expiryHeap.length > 0 && (this.expiryHeap[0]?.expiresAt ?? Number.POSITIVE_INFINITY) <= now) {
      const next = this.popExpiry();
      if (next == null) {
        return;
      }
      const bucket = this.entries.get(next.key);
      if (bucket == null || bucket.earliestExpiry !== next.expiresAt) {
        continue;
      }
      const validEntries = bucket.entries.filter((entry) => entry.expiresAt > now);
      this.setBucket(next.key, validEntries);
    }
  }

  private enforceBucketLimit(): void {
    while (this.entries.size > this.maxBuckets) {
      const oldest = this.popExpiry();
      if (oldest == null) {
        return;
      }
      const bucket = this.entries.get(oldest.key);
      if (bucket == null || bucket.earliestExpiry !== oldest.expiresAt) {
        continue;
      }
      this.entries.delete(oldest.key);
    }
  }

  private setBucket(key: DeduplicationKey, entries: DeduplicationEntry[]): void {
    if (entries.length === 0) {
      this.entries.delete(key);
      return;
    }
    let earliestExpiry = Number.POSITIVE_INFINITY;
    for (const entry of entries) {
      earliestExpiry = Math.min(earliestExpiry, entry.expiresAt);
    }
    this.entries.set(key, {
      entries,
      earliestExpiry,
    });
    this.pushExpiry({ key, expiresAt: earliestExpiry });
  }

  private pushExpiry(entry: ExpiryHeapEntry): void {
    this.expiryHeap.push(entry);
    let index = this.expiryHeap.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if ((this.expiryHeap[parentIndex]?.expiresAt ?? 0) <= (this.expiryHeap[index]?.expiresAt ?? 0)) {
        break;
      }
      [this.expiryHeap[parentIndex], this.expiryHeap[index]] = [this.expiryHeap[index]!, this.expiryHeap[parentIndex]!];
      index = parentIndex;
    }
  }

  private popExpiry(): ExpiryHeapEntry | null {
    if (this.expiryHeap.length === 0) {
      return null;
    }
    const top = this.expiryHeap[0] ?? null;
    const tail = this.expiryHeap.pop() ?? null;
    if (this.expiryHeap.length > 0 && tail != null) {
      this.expiryHeap[0] = tail;
      this.heapifyDown(0);
    }
    return top;
  }

  private heapifyDown(index: number): void {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let nextIndex = index;
      if ((this.expiryHeap[left]?.expiresAt ?? Number.POSITIVE_INFINITY) < (this.expiryHeap[nextIndex]?.expiresAt ?? Number.POSITIVE_INFINITY)) {
        nextIndex = left;
      }
      if ((this.expiryHeap[right]?.expiresAt ?? Number.POSITIVE_INFINITY) < (this.expiryHeap[nextIndex]?.expiresAt ?? Number.POSITIVE_INFINITY)) {
        nextIndex = right;
      }
      if (nextIndex === index) {
        return;
      }
      [this.expiryHeap[index], this.expiryHeap[nextIndex]] = [this.expiryHeap[nextIndex]!, this.expiryHeap[index]!];
      index = nextIndex;
    }
  }
}

export function createDefaultDeduplicationConfig(): DeduplicationConfig {
  return {
    windowMs: 60_000,
    maxFingerprints: 10_000,
    includeBody: true,
    perTenant: true,
  };
}

/**
 * Creates a deduplication middleware with the given configuration.
 */
export function createDeduplicationMiddleware(config: Partial<DeduplicationConfig> = {}): DeduplicationMiddleware {
  return new DeduplicationMiddleware({ ...createDefaultDeduplicationConfig(), ...config });
}

/**
 * Global deduplication middleware instance.
 */
const globalDeduplicationMiddleware = createGlobalSingletonSlot<DeduplicationMiddleware>();

/**
 * Get or create the global deduplication middleware.
 */
export function getGlobalDeduplicationMiddleware(): DeduplicationMiddleware {
  return getOrCreateGlobalSingleton(
    globalDeduplicationMiddleware,
    () => createDeduplicationMiddleware(),
    { name: "request-deduplication-middleware" },
  );
}

/**
 * Reset the global deduplication middleware.
 */
export function resetGlobalDeduplicationMiddleware(): void {
  resetGlobalSingleton(globalDeduplicationMiddleware);
}
