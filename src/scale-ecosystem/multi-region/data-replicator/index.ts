/**
 * Data Replicator
 *
 * Implements CDC (Change Data Capture) based data replication across regions.
 * Part of §52 multi-region data sync.
 */

import { z } from "zod";
import { createHash } from "node:crypto";
import { nowIso } from "../../../platform/contracts/types/ids.js";

export const ReplicationPolicySchema = z.object({
  sourceRegionId: z.string().min(1),
  targetRegionIds: z.array(z.string()).default([]),
  residencyMode: z.enum(["same_jurisdiction", "allowed_cross_border", "blocked"]).default("same_jurisdiction"),
});

export type ReplicationPolicy = z.infer<typeof ReplicationPolicySchema>;

export function shouldReplicateToRegion(policy: ReplicationPolicy, targetRegionId: string): boolean {
  return policy.residencyMode !== "blocked" && policy.targetRegionIds.includes(targetRegionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReplicationEvent {
  eventId: string;
  sourceRegionId: string;
  targetRegionId: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  timestamp: string;
  checksum: string;
}

export interface ReplicationCheckpoint {
  checkpointId: string;
  sourceRegionId: string;
  targetRegionId: string;
  sequenceNumber: number;
  timestamp: string;
  pendingCount: number;
}

export interface ReplicationResult {
  success: boolean;
  eventsReplicated: number;
  lastSequence: number;
  errors: readonly string[];
}

export interface DataReplicatorConfig {
  sourceRegionId: string;
  targetRegionIds: readonly string[];
  policy: ReplicationPolicy;
  batchSize: number;
  flushIntervalMs: number;
  retryAttempts: number;
  checksumAlgorithm: "sha256" | "md5";
  emit?: (targetRegionId: string, event: ReplicationEvent) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Replication Event Buffer
// ─────────────────────────────────────────────────────────────────────────────

export class ReplicationEventBuffer {
  private buffer: ReplicationEvent[] = [];
  private readonly maxSize: number;
  private readonly flushIntervalMs: number;
  private lastFlushAt: number = Date.now();
  private timer: ReturnType<typeof setTimeout> | null = null;

  public constructor(maxSize = 1000, flushIntervalMs = 5000) {
    this.maxSize = maxSize;
    this.flushIntervalMs = flushIntervalMs;
  }

  public add(event: ReplicationEvent): boolean {
    this.buffer.push(event);
    if (this.buffer.length >= this.maxSize) {
      return true;
    }
    this.scheduleFlush();
    return false;
  }

  public flush(): ReplicationEvent[] {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const events = this.buffer;
    this.buffer = [];
    this.lastFlushAt = Date.now();
    return events;
  }

  private flushTimer(): ReplicationEvent[] {
    const flushed = this.flush();
    return flushed;
  }

  public size(): number {
    return this.buffer.length;
  }

  public shouldFlush(): boolean {
    return this.buffer.length > 0 && (Date.now() - this.lastFlushAt) >= this.flushIntervalMs;
  }

  private scheduleFlush(): void {
    if (this.timer || this.buffer.length === 0) return;
    this.timer = setTimeout(() => {
      this.flushTimer();
    }, this.flushIntervalMs);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Checksum Utility
// ─────────────────────────────────────────────────────────────────────────────

export function computeChecksum(payload: unknown, algorithm: "sha256" | "md5" = "sha256"): string {
  const data = JSON.stringify(payload);
  return createHash(algorithm).update(data).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Replicator Service
// ─────────────────────────────────────────────────────────────────────────────

export class DataReplicatorService {
  private readonly config: DataReplicatorConfig;
  private readonly buffers = new Map<string, ReplicationEventBuffer>();
  private checkpoints = new Map<string, ReplicationCheckpoint>();
  private readonly eventHandlers = new Map<string, (event: ReplicationEvent) => Promise<void>>();
  private readonly emit: (targetRegionId: string, event: ReplicationEvent) => void;

  public constructor(config: DataReplicatorConfig) {
    this.config = { ...config };
    this.emit = config.emit ?? (() => {});
    for (const regionId of config.targetRegionIds) {
      this.buffers.set(regionId, new ReplicationEventBuffer(this.config.batchSize, this.config.flushIntervalMs));
    }
  }

  /**
   * Get buffer for a target region
   */
  public getBuffer(targetRegionId: string): ReplicationEventBuffer | null {
    return this.buffers.get(targetRegionId) ?? null;
  }

  /**
   * Get checkpoint for a target region
   */
  public getCheckpoint(targetRegionId: string): ReplicationCheckpoint | null {
    return this.checkpoints.get(`${this.config.sourceRegionId}:${targetRegionId}`) ?? null;
  }

  /**
   * Record a replication event
   * Per R15-54: checks shouldReplicateToRegion() to enforce residency policy
   */
  public recordEvent(
    targetRegionId: string,
    aggregateType: string,
    aggregateId: string,
    payload: unknown,
  ): ReplicationEvent | null {
    // Check if replication to this region is allowed by policy
    if (!shouldReplicateToRegion(this.config.policy, targetRegionId)) {
      return null;
    }

    const event: ReplicationEvent = {
      // Root cause: Date.now() + Math.random() causes ID collisions under high concurrency
      // Fix: Use crypto.randomUUID() for globally unique, collision-free IDs
      eventId: `repl_${globalThis.crypto.randomUUID()}`,
      sourceRegionId: this.config.sourceRegionId,
      targetRegionId,
      aggregateType,
      aggregateId,
      payload,
      timestamp: nowIso(),
      checksum: computeChecksum(payload, this.config.checksumAlgorithm),
    };

    const buffer = this.buffers.get(targetRegionId);
    if (buffer) {
      const shouldFlush = buffer.add(event);
      if (shouldFlush) {
        void this.flush(targetRegionId);
      }
    }

    return event;
  }

  /**
   * Flush all buffers and return replication result
   */
  public async flush(targetRegionId: string): Promise<ReplicationResult> {
    const buffer = this.buffers.get(targetRegionId);
    if (!buffer) {
      return {
        success: false,
        eventsReplicated: 0,
        lastSequence: 0,
        errors: [`Unknown target region: ${targetRegionId}`],
      };
    }

    const events = buffer.flush();
    if (events.length === 0) {
      return {
        success: true,
        eventsReplicated: 0,
        lastSequence: 0,
        errors: [],
      };
    }

    const errors: string[] = [];
    let lastSequence = 0;

    for (const event of events) {
      try {
        await this.sendToTarget(targetRegionId, event);
        lastSequence++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
        // Retry logic
        for (let attempt = 1; attempt < this.config.retryAttempts; attempt++) {
          try {
            await this.sendToTarget(targetRegionId, event);
            errors.pop(); // Remove the error we just resolved
            break;
          } catch {
            // Continue to next retry
          }
        }
      }
    }

    // Update checkpoint with actual pending count
    // pendingCount = events still in buffer waiting to be sent + in-flight (not yet acknowledged)
    // Root cause: Using local `lastSequence` counter which resets on restart, causing duplicate consumption
    // Fix: Use the checkpoint's last sequence + events.length to get actual sequence
    const currentBuffer = this.buffers.get(targetRegionId);
    const actualPendingCount = errors.length;
    const checkpointKey = `${this.config.sourceRegionId}:${targetRegionId}`;
    const existingCheckpoint = this.checkpoints.get(checkpointKey);
    const baseSequence = existingCheckpoint?.sequenceNumber ?? 0;
    this.checkpoints.set(checkpointKey, {
      checkpointId: `cp_${Date.now()}`,
      sourceRegionId: this.config.sourceRegionId,
      targetRegionId,
      // Use persistent base sequence + offset instead of local counter
      sequenceNumber: baseSequence + events.length,
      timestamp: nowIso(),
      pendingCount: Math.max(0, actualPendingCount),
    });

    return {
      success: errors.length === 0,
      eventsReplicated: events.length - errors.length,
      lastSequence,
      errors,
    };
  }

  /**
   * Flush all region buffers
   */
  public async flushAll(): Promise<Map<string, ReplicationResult>> {
    const results = new Map<string, ReplicationResult>();
    for (const regionId of this.config.targetRegionIds) {
      results.set(regionId, await this.flush(regionId));
    }
    return results;
  }

  /**
   * Register event handler for incoming replication events
   */
  public onEvent(sourceRegionId: string, handler: (event: ReplicationEvent) => Promise<void>): void {
    this.eventHandlers.set(sourceRegionId, handler);
  }

  /**
   * Handle incoming replication event (called by remote region)
   */
  public async handleIncomingEvent(event: ReplicationEvent): Promise<void> {
    const handler = this.eventHandlers.get(event.sourceRegionId);
    if (handler) {
      await handler(event);
    }
  }

  /**
   * Validate incoming event checksum
   */
  public validateEvent(event: ReplicationEvent): boolean {
    const expectedChecksum = computeChecksum(event.payload, this.config.checksumAlgorithm);
    return event.checksum === expectedChecksum;
  }

  /**
   * Get replication status for all target regions
   */
  public getStatus(): ReadonlyMap<string, { bufferSize: number; pendingCheckpoint: ReplicationCheckpoint | null }> {
    const status = new Map<string, { bufferSize: number; pendingCheckpoint: ReplicationCheckpoint | null }>();
    for (const [regionId, buffer] of this.buffers) {
      const checkpointKey = `${this.config.sourceRegionId}:${regionId}`;
      status.set(regionId, {
        bufferSize: buffer.size(),
        pendingCheckpoint: this.checkpoints.get(checkpointKey) ?? null,
      });
    }
    return status;
  }

  private async sendToTarget(targetRegionId: string, event: ReplicationEvent): Promise<void> {
    // In production, this would use actual network transport (HTTP/gRPC/MessageQueue)
    // For now, simulate the send operation
    const handler = this.eventHandlers.get(targetRegionId);
    if (handler) {
      await handler(event);
    }
    this.emit(targetRegionId, event);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createDataReplicator(
  sourceRegionId: string,
  targetRegionIds: readonly string[],
  policy: ReplicationPolicy,
  options?: Partial<Omit<DataReplicatorConfig, "sourceRegionId" | "targetRegionIds" | "policy">>,
): DataReplicatorService {
  return new DataReplicatorService({
    sourceRegionId,
    targetRegionIds,
    policy,
    batchSize: options?.batchSize ?? 100,
    flushIntervalMs: options?.flushIntervalMs ?? 5000,
    retryAttempts: options?.retryAttempts ?? 3,
    checksumAlgorithm: options?.checksumAlgorithm ?? "sha256",
  });
}
