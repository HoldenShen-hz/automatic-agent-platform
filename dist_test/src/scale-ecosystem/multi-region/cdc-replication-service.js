/**
 * CDC Replication Service
 *
 * Implements multi-region data synchronization using Change Data Capture (CDC).
 * Based on event store for asynchronous cross-region replication.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
/**
 * CDC replication event types
 */
export const CDC_EVENT_TYPES = [
    "cdc:replication_started",
    "cdc:replication_completed",
    "cdc:replication_failed",
    "cdc:checkpoint_updated",
];
/**
 * CDC replication service for multi-region data sync
 */
export class CDCReplicationService {
    checkpoints = new Map();
    configs = new Map();
    replicationQueues = new Map();
    /**
     * Register a replication configuration
     */
    registerReplication(config) {
        const key = this.getConfigKey(config.sourceRegionId, config.targetRegionId);
        this.configs.set(key, config);
        // Initialize checkpoint if not exists
        if (!this.checkpoints.has(key)) {
            this.checkpoints.set(key, {
                checkpointId: newId("cdc_checkpoint"),
                sourceRegionId: config.sourceRegionId,
                targetRegionId: config.targetRegionId,
                lastEventId: null,
                lastEventSequence: 0,
                processedAt: nowIso(),
            });
        }
    }
    /**
     * Get replication configuration
     */
    getConfig(sourceRegionId, targetRegionId) {
        return this.configs.get(this.getConfigKey(sourceRegionId, targetRegionId));
    }
    /**
     * Get current checkpoint for replication pair
     */
    getCheckpoint(sourceRegionId, targetRegionId) {
        return this.checkpoints.get(this.getConfigKey(sourceRegionId, targetRegionId));
    }
    /**
     * Prepare a replication batch from source events
     */
    prepareBatch(sourceRegionId, targetRegionId, sourceEvents) {
        const key = this.getConfigKey(sourceRegionId, targetRegionId);
        const checkpoint = this.checkpoints.get(key);
        if (!checkpoint) {
            return null;
        }
        const config = this.configs.get(key);
        const batchSize = config?.batchSize ?? 100;
        // Filter events after checkpoint
        const eventsToReplicate = sourceEvents.filter((event) => event.sequence > checkpoint.lastEventSequence);
        if (eventsToReplicate.length === 0) {
            return null;
        }
        const batchEvents = eventsToReplicate.slice(0, batchSize);
        const startSequence = batchEvents[0]?.sequence ?? checkpoint.lastEventSequence;
        const endSequence = batchEvents[batchEvents.length - 1]?.sequence ?? startSequence;
        const batch = {
            batchId: newId("cdc_batch"),
            sourceRegionId,
            targetRegionId,
            events: batchEvents,
            startSequence,
            endSequence,
            createdAt: nowIso(),
        };
        // Queue batch for async replication
        this.enqueueBatch(key, batch);
        return batch;
    }
    /**
     * Mark batch as replicated and update checkpoint
     */
    confirmBatch(sourceRegionId, targetRegionId, batch) {
        const key = this.getConfigKey(sourceRegionId, targetRegionId);
        const lastEvent = batch.events[batch.events.length - 1];
        const checkpoint = {
            checkpointId: this.checkpoints.get(key)?.checkpointId ?? newId("cdc_checkpoint"),
            sourceRegionId,
            targetRegionId,
            lastEventId: lastEvent?.id ?? null,
            lastEventSequence: batch.endSequence,
            processedAt: nowIso(),
        };
        this.checkpoints.set(key, checkpoint);
    }
    /**
     * Record failed replication
     */
    recordFailure(sourceRegionId, targetRegionId, batch, error) {
        const key = this.getConfigKey(sourceRegionId, targetRegionId);
        console.error(`CDC replication failed for ${key}: ${error}`);
    }
    /**
     * Get replication status for a region pair
     */
    getStatus(sourceRegionId, targetRegionId) {
        const key = this.getConfigKey(sourceRegionId, targetRegionId);
        const queue = this.replicationQueues.get(key);
        if (!queue || queue.length === 0) {
            return "idle";
        }
        // Check if there's pending work
        const hasPending = queue.some((batch) => batch.events.length > 0);
        return hasPending ? "syncing" : "idle";
    }
    /**
     * Get all registered region pairs
     */
    getRegisteredRegionPairs() {
        const pairs = [];
        for (const key of this.configs.keys()) {
            const parts = key.split("->");
            if (parts.length === 2 && parts[0] && parts[1]) {
                pairs.push({ sourceRegionId: parts[0], targetRegionId: parts[1] });
            }
        }
        return pairs;
    }
    /**
     * Check if replication is enabled for a region pair
     */
    isEnabled(sourceRegionId, targetRegionId) {
        const config = this.getConfig(sourceRegionId, targetRegionId);
        return config?.enabled ?? false;
    }
    /**
     * Calculate replication lag (events behind)
     */
    getReplicationLag(sourceRegionId, targetRegionId, totalSourceEvents) {
        const checkpoint = this.getCheckpoint(sourceRegionId, targetRegionId);
        if (!checkpoint) {
            return totalSourceEvents;
        }
        return Math.max(0, totalSourceEvents - checkpoint.lastEventSequence);
    }
    /**
     * Enqueue batch for async replication
     */
    enqueueBatch(key, batch) {
        const queue = this.replicationQueues.get(key) ?? [];
        queue.push(batch);
        this.replicationQueues.set(key, queue);
    }
    /**
     * Get config key
     */
    getConfigKey(sourceRegionId, targetRegionId) {
        return `${sourceRegionId}->${targetRegionId}`;
    }
}
/**
 * Multi-region replication coordinator
 *
 * Manages CDC replication across multiple regions.
 */
export class MultiRegionReplicationCoordinator {
    cdcService;
    regionConfigs = new Map();
    constructor(cdcService) {
        this.cdcService = cdcService ?? new CDCReplicationService();
    }
    /**
     * Set up replication for a region with all target regions
     */
    setupRegionReplication(sourceRegionId, targets) {
        const configs = [];
        for (const target of targets) {
            const config = {
                sourceRegionId,
                targetRegionId: target.targetRegionId,
                batchSize: target.batchSize ?? 100,
                replicationIntervalMs: target.intervalMs ?? 5000,
                enabled: true,
                retryPolicy: {
                    maxRetries: 3,
                    backoffMs: 1000,
                },
            };
            this.cdcService.registerReplication(config);
            configs.push(config);
        }
        this.regionConfigs.set(sourceRegionId, configs);
    }
    /**
     * Get the CDC service
     */
    getCDCService() {
        return this.cdcService;
    }
    /**
     * Get all replications for a source region
     */
    getRegionReplications(sourceRegionId) {
        return this.regionConfigs.get(sourceRegionId) ?? [];
    }
}
//# sourceMappingURL=cdc-replication-service.js.map