/**
 * Data Replicator
 *
 * Implements CDC (Change Data Capture) based data replication across regions.
 * Part of §52 multi-region data sync.
 */
import { z } from "zod";
import { nowIso } from "../../../platform/contracts/types/ids.js";
export const ReplicationPolicySchema = z.object({
    sourceRegionId: z.string().min(1),
    targetRegionIds: z.array(z.string()).default([]),
    residencyMode: z.enum(["same_jurisdiction", "allowed_cross_border", "blocked"]),
});
export function shouldReplicateToRegion(policy, targetRegionId) {
    return policy.residencyMode !== "blocked" && policy.targetRegionIds.includes(targetRegionId);
}
// ─────────────────────────────────────────────────────────────────────────────
// Replication Event Buffer
// ─────────────────────────────────────────────────────────────────────────────
export class ReplicationEventBuffer {
    buffer = [];
    maxSize;
    flushIntervalMs;
    lastFlushAt = Date.now();
    timer = null;
    constructor(maxSize = 1000, flushIntervalMs = 5000) {
        this.maxSize = maxSize;
        this.flushIntervalMs = flushIntervalMs;
    }
    add(event) {
        this.buffer.push(event);
        if (this.buffer.length >= this.maxSize) {
            this.flush();
            return true;
        }
        this.scheduleFlush();
        return false;
    }
    flush() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        const events = this.buffer;
        this.buffer = [];
        this.lastFlushAt = Date.now();
        return events;
    }
    size() {
        return this.buffer.length;
    }
    shouldFlush() {
        return this.buffer.length > 0 && (Date.now() - this.lastFlushAt) >= this.flushIntervalMs;
    }
    scheduleFlush() {
        if (this.timer || this.buffer.length === 0)
            return;
        this.timer = setTimeout(() => {
            this.flush();
        }, this.flushIntervalMs);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Checksum Utility
// ─────────────────────────────────────────────────────────────────────────────
export function computeChecksum(payload, algorithm = "sha256") {
    const data = JSON.stringify(payload);
    if (algorithm === "sha256") {
        const { createHash } = require("node:crypto");
        return createHash("sha256").update(data).digest("hex");
    }
    const { createHash } = require("node:crypto");
    return createHash("md5").update(data).digest("hex");
}
// ─────────────────────────────────────────────────────────────────────────────
// Data Replicator Service
// ─────────────────────────────────────────────────────────────────────────────
export class DataReplicatorService {
    config;
    buffers = new Map();
    checkpoints = new Map();
    eventHandlers = new Map();
    constructor(config) {
        this.config = { ...config };
        for (const regionId of config.targetRegionIds) {
            this.buffers.set(regionId, new ReplicationEventBuffer(this.config.batchSize, this.config.flushIntervalMs));
        }
    }
    /**
     * Get buffer for a target region
     */
    getBuffer(targetRegionId) {
        return this.buffers.get(targetRegionId) ?? null;
    }
    /**
     * Get checkpoint for a target region
     */
    getCheckpoint(targetRegionId) {
        return this.checkpoints.get(`${this.config.sourceRegionId}:${targetRegionId}`) ?? null;
    }
    /**
     * Record a replication event
     */
    recordEvent(targetRegionId, aggregateType, aggregateId, payload) {
        const event = {
            eventId: `repl_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
            buffer.add(event);
        }
        return event;
    }
    /**
     * Flush all buffers and return replication result
     */
    async flush(targetRegionId) {
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
        const errors = [];
        let lastSequence = 0;
        for (const event of events) {
            try {
                await this.sendToTarget(targetRegionId, event);
                lastSequence++;
            }
            catch (err) {
                errors.push(err instanceof Error ? err.message : String(err));
                // Retry logic
                for (let attempt = 1; attempt < this.config.retryAttempts; attempt++) {
                    try {
                        await this.sendToTarget(targetRegionId, event);
                        lastSequence++;
                        errors.pop(); // Remove the error we just resolved
                        break;
                    }
                    catch {
                        // Continue to next retry
                    }
                }
            }
        }
        // Update checkpoint
        const checkpointKey = `${this.config.sourceRegionId}:${targetRegionId}`;
        this.checkpoints.set(checkpointKey, {
            checkpointId: `cp_${Date.now()}`,
            sourceRegionId: this.config.sourceRegionId,
            targetRegionId,
            sequenceNumber: lastSequence,
            timestamp: nowIso(),
            pendingCount: events.length,
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
    async flushAll() {
        const results = new Map();
        for (const regionId of this.config.targetRegionIds) {
            results.set(regionId, await this.flush(regionId));
        }
        return results;
    }
    /**
     * Register event handler for incoming replication events
     */
    onEvent(sourceRegionId, handler) {
        this.eventHandlers.set(sourceRegionId, handler);
    }
    /**
     * Handle incoming replication event (called by remote region)
     */
    async handleIncomingEvent(event) {
        const handler = this.eventHandlers.get(event.sourceRegionId);
        if (handler) {
            await handler(event);
        }
    }
    /**
     * Validate incoming event checksum
     */
    validateEvent(event) {
        const expectedChecksum = computeChecksum(event.payload, this.config.checksumAlgorithm);
        return event.checksum === expectedChecksum;
    }
    /**
     * Get replication status for all target regions
     */
    getStatus() {
        const status = new Map();
        for (const [regionId, buffer] of this.buffers) {
            const checkpointKey = `${this.config.sourceRegionId}:${regionId}`;
            status.set(regionId, {
                bufferSize: buffer.size(),
                pendingCheckpoint: this.checkpoints.get(checkpointKey) ?? null,
            });
        }
        return status;
    }
    async sendToTarget(targetRegionId, event) {
        // In production, this would use actual network transport (HTTP/gRPC/MessageQueue)
        // For now, simulate the send operation
        const handler = this.eventHandlers.get(targetRegionId);
        if (handler) {
            await handler(event);
        }
        // Emit event for external listeners
        this.emit?.(targetRegionId, event);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────
export function createDataReplicator(sourceRegionId, targetRegionIds, policy, options) {
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
//# sourceMappingURL=index.js.map