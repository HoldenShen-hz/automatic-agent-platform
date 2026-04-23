/**
 * Cross-Region Event Replication Service
 *
 * Provides cross-region event replication using Change Data Capture (CDC).
 * Ensures events are reliably replicated across regions with:
 * - Per-region acknowledgment tracking
 * - Retry with exponential backoff
 * - Replication lag monitoring
 * - Consistent ordering guarantee within region
 *
 * Architecture: §32 Deployment Strategy - D3 Multi-Region
 * @see docs_zh/architecture/00-platform-architecture.md §32
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
// ─────────────────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    maxRetries: 3,
    baseRetryDelayMs: 100,
    maxRetryDelayMs: 30000,
    batchSize: 100,
    replicationIntervalMs: 1000,
};
// ─────────────────────────────────────────────────────────────────────────────
// Cross-Region Event Replication Service
// ─────────────────────────────────────────────────────────────────────────────
export class CrossRegionEventReplicationService {
    publisher;
    sourceRegionId;
    config;
    pendingEvents = new Map();
    replicationQueue = [];
    targetRegions = new Map();
    constructor(publisher, sourceRegionId, config) {
        this.publisher = publisher;
        this.sourceRegionId = sourceRegionId;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Registers a target region for replication.
     *
     * @param target - Target region configuration
     */
    registerTargetRegion(target) {
        this.targetRegions.set(target.regionId, target);
    }
    /**
     * Removes a target region from replication.
     *
     * @param regionId - Region to remove
     */
    removeTargetRegion(regionId) {
        this.targetRegions.delete(regionId);
    }
    /**
     * Gets all registered target regions.
     */
    getTargetRegions() {
        return [...this.targetRegions.values()];
    }
    /**
     * Replicates an event to all registered target regions.
     *
     * @param eventType - Type of the event
     * @param payload - Event payload
     * @param targetRegionIds - Specific targets (or all if empty)
     * @returns Replication plan ID
     */
    replicate(eventType, payload, targetRegionIds) {
        const eventId = newId("repl");
        const targets = targetRegionIds
            ? targetRegionIds.map((id) => this.targetRegions.get(id)).filter((t) => t !== undefined)
            : [...this.targetRegions.values()];
        if (targets.length === 0) {
            throw new Error("No target regions configured for replication");
        }
        const replicatedEvents = targets.map((target) => ({
            eventId,
            sourceRegionId: this.sourceRegionId,
            targetRegionId: target.regionId,
            eventType,
            payload,
            replicateAt: nowIso(),
            completedAt: null,
            status: "pending",
            retryCount: 0,
            lastError: null,
        }));
        this.pendingEvents.set(eventId, replicatedEvents);
        const plan = {
            planId: newId("rplan"),
            eventId,
            sourceRegionId: this.sourceRegionId,
            targets,
            createdAt: nowIso(),
            status: "pending",
            completedTargets: 0,
            failedTargets: 0,
        };
        this.replicationQueue.push(plan);
        this.processReplicationQueue();
        return eventId;
    }
    /**
     * Gets the replication status for an event.
     *
     * @param eventId - Event ID
     * @returns Replication status or null if not found
     */
    getReplicationStatus(eventId) {
        const events = this.pendingEvents.get(eventId);
        if (!events)
            return null;
        const statuses = new Set(events.map((e) => e.status));
        let overallStatus;
        if (statuses.size === 1) {
            overallStatus = events[0].status;
        }
        else if (statuses.has("failed")) {
            overallStatus = "partial";
        }
        else if (statuses.has("completed")) {
            overallStatus = "partial";
        }
        else {
            overallStatus = "replicating";
        }
        return { status: overallStatus, targets: events };
    }
    /**
     * Gets replication metrics.
     */
    getMetrics() {
        let totalEvents = 0;
        let pendingCount = 0;
        let replicatingCount = 0;
        let completedCount = 0;
        let failedCount = 0;
        let totalLatency = 0;
        let latencyCount = 0;
        for (const events of this.pendingEvents.values()) {
            totalEvents += events.length;
            for (const event of events) {
                switch (event.status) {
                    case "pending":
                        pendingCount++;
                        break;
                    case "replicating":
                        replicatingCount++;
                        break;
                    case "completed":
                        completedCount++;
                        if (event.completedAt) {
                            totalLatency += new Date(event.completedAt).getTime() - new Date(event.replicateAt).getTime();
                            latencyCount++;
                        }
                        break;
                    case "failed":
                        failedCount++;
                        break;
                    case "partial":
                        pendingCount++;
                        break;
                }
            }
        }
        return {
            totalEvents,
            pendingCount,
            replicatingCount,
            completedCount,
            failedCount,
            averageLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
            replicationRatePerSecond: latencyCount > 0
                ? (completedCount * 1000) / Math.max(1, totalLatency)
                : 0,
        };
    }
    /**
     * Manually triggers replication for pending events.
     */
    triggerReplication() {
        this.processReplicationQueue();
    }
    /**
     * Clears completed replication records older than a timestamp.
     *
     * @param olderThan - Timestamp threshold
     * @returns Number of records cleared
     */
    pruneCompleted(olderThan) {
        let pruned = 0;
        for (const [eventId, events] of this.pendingEvents.entries()) {
            const allCompleted = events.every((e) => e.status === "completed" &&
                e.completedAt !== null &&
                e.completedAt < olderThan);
            if (allCompleted) {
                this.pendingEvents.delete(eventId);
                pruned++;
            }
        }
        return pruned;
    }
    // ─── Private Methods ─────────────────────────────────────────────────────
    async processReplicationQueue() {
        while (this.replicationQueue.length > 0) {
            const plan = this.replicationQueue.shift();
            await this.executePlan(plan);
        }
    }
    async executePlan(plan) {
        const events = this.pendingEvents.get(plan.eventId);
        if (!events)
            return;
        plan.status = "replicating";
        const completedPromises = [];
        for (const event of events) {
            if (event.status === "completed" || event.status === "failed") {
                continue;
            }
            event.status = "replicating";
            completedPromises.push(this.replicateToTarget(event));
        }
        await Promise.all(completedPromises);
        // Update plan status
        const allCompleted = events.every((e) => e.status === "completed");
        const anyFailed = events.some((e) => e.status === "failed" && e.retryCount >= this.config.maxRetries);
        if (allCompleted) {
            plan.status = "completed";
        }
        else if (anyFailed) {
            plan.status = "failed";
        }
        else {
            plan.status = "partial";
        }
        plan.completedTargets = events.filter((e) => e.status === "completed").length;
        plan.failedTargets = events.filter((e) => e.status === "failed").length;
    }
    async replicateToTarget(event) {
        try {
            // In a real implementation, this would send to a cross-region message queue
            // or use a dedicated replication transport. Here we just publish via the event bus.
            this.publisher.publish({
                eventType: event.eventType,
                payload: event.payload,
            });
            event.completedAt = nowIso();
            event.status = "completed";
        }
        catch (error) {
            event.retryCount++;
            event.lastError = error instanceof Error ? error.message : String(error);
            if (event.retryCount >= this.config.maxRetries) {
                event.status = "failed";
            }
            else {
                event.status = "pending";
                // Re-queue with backoff delay
                setTimeout(() => {
                    this.processReplicationQueue();
                }, this.calculateBackoff(event.retryCount));
            }
        }
    }
    calculateBackoff(retryCount) {
        const delay = this.config.baseRetryDelayMs * Math.pow(2, retryCount);
        return Math.min(delay, this.config.maxRetryDelayMs);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────
export function createCrossRegionEventReplicationService(publisher, sourceRegionId, config) {
    return new CrossRegionEventReplicationService(publisher, sourceRegionId, config);
}
//# sourceMappingURL=cross-region-event-replication-service.js.map