/**
 * @fileoverview Coordinator Load Balancing Service - Scheduler coordinator selection.
 *
 * Manages coordinator instance registration, heartbeat tracking, and selection
 * for the HA-coordinated task scheduling system. Multiple coordinators can run
 * in different regions for high availability and geographic distribution.
 *
 * Key concepts:
 * - Coordinator: A scheduler instance that assigns tasks to workers
 * - Heartbeat: Periodic health/report from coordinators
 * - Selection: Choosing the best coordinator based on load, region, and affinity
 *
 * @see HA Coordinator Service: ha-coordinator-service.ts
 */
import { createHash } from "node:crypto";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { ValidationError } from "../../contracts/errors.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
function stableHash(input) {
    const digest = createHash("sha256").update(input, "utf8").digest("hex").slice(0, 8);
    return Number.parseInt(digest, 16);
}
function normalizeIdentifier(value, code) {
    const normalized = value.trim();
    if (!/^[a-zA-Z0-9._:-]{2,128}$/.test(normalized)) {
        throw new ValidationError(code, `Invalid identifier: ${value}`, {
            details: { value, pattern: "^[a-zA-Z0-9._:-]{2,128}$" },
        });
    }
    return normalized;
}
function normalizeQueueAffinity(value) {
    if (value == null) {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}
function normalizeShards(value) {
    return [...new Set((value ?? []).map((item) => item.trim()).filter((item) => item.length > 0))].sort();
}
function readShards(record) {
    try {
        const parsed = JSON.parse(record.shardJson);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    }
    catch (err) {
        logger.log({
            level: "warn",
            message: "Failed to parse shards",
            data: { error: err instanceof Error ? err.message : String(err), shardJson: record.shardJson.substring(0, 100) },
        });
        return [];
    }
}
/**
 * Computes a load score for coordinator selection.
 *
 * Lower scores indicate better selection candidates. Score components:
 * - activeRatio: How full the coordinator is relative to capacity
 * - backlogPenalty: Extra weight for coordinators with pending work
 * - cpuPenalty: Resource pressure if CPU metrics are available
 * - queueBonus: Negative bonus if coordinator prefers the requested queue
 * - regionBonus: Negative bonus if coordinator is in the preferred region
 */
function computeCoordinatorScore(record, input) {
    const capacity = Math.max(1, record.maxConcurrentDispatches);
    const activeRatio = record.activeDispatchCount / capacity;
    const backlogPenalty = Math.min(record.backlogCount / capacity, 4) * 0.2;
    const cpuPenalty = record.cpuPct == null ? 0 : Math.min(Math.max(record.cpuPct, 0), 100) / 100 * 0.2;
    const queueBonus = input.queueName != null && record.queueAffinity === input.queueName ? -0.2 : 0;
    const regionBonus = input.preferredRegion != null && record.region === input.preferredRegion ? -0.15 : 0;
    return activeRatio + backlogPenalty + cpuPenalty + queueBonus + regionBonus;
}
export class CoordinatorLoadBalancingService {
    db;
    store;
    constructor(db, store) {
        this.db = db;
        this.store = store;
    }
    /**
     * Registers or updates a coordinator's heartbeat.
     *
     * Creates a new coordinator record if this is the first heartbeat,
     * or updates the existing record with new load metrics. The
     * coordinator ID is generated if not provided.
     */
    registerHeartbeat(input) {
        return this.db.transaction(() => {
            const heartbeatAt = input.heartbeatAt ?? nowIso();
            const coordinatorId = input.coordinatorId == null
                ? newId("coordinator")
                : normalizeIdentifier(input.coordinatorId, "control_plane.invalid_coordinator_id");
            const existing = this.store.worker.getCoordinatorInstanceSnapshot(coordinatorId);
            const record = {
                coordinatorId,
                region: normalizeIdentifier(input.region, "control_plane.invalid_region"),
                role: normalizeIdentifier(input.role ?? "scheduler", "control_plane.invalid_role"),
                queueAffinity: normalizeQueueAffinity(input.queueAffinity),
                status: input.status ?? "active",
                maxConcurrentDispatches: Math.max(1, Math.trunc(input.maxConcurrentDispatches ?? 8)),
                activeDispatchCount: Math.max(0, Math.trunc(input.activeDispatchCount ?? 0)),
                backlogCount: Math.max(0, Math.trunc(input.backlogCount ?? 0)),
                cpuPct: input.cpuPct == null ? null : Math.min(Math.max(input.cpuPct, 0), 100),
                shardJson: JSON.stringify(normalizeShards(input.shards)),
                lastHeartbeatAt: heartbeatAt,
                metadataJson: input.metadata == null ? null : JSON.stringify(input.metadata),
                createdAt: existing?.createdAt ?? heartbeatAt,
                updatedAt: heartbeatAt,
            };
            this.store.worker.upsertCoordinatorInstanceSnapshot(record);
            return this.store.worker.getCoordinatorInstanceSnapshot(coordinatorId) ?? record;
        });
    }
    /**
     * Lists all coordinator snapshots.
     */
    listSnapshots(limit = 100) {
        return this.store.worker.listCoordinatorInstanceSnapshots(limit);
    }
    /**
     * Builds an aggregate summary of coordinator load across the fleet.
     *
     * Includes counts by status, total capacity, and identification of
     * "hot" coordinators (load score >= 1.0) that may need attention.
     */
    buildSummary(generatedAt = nowIso()) {
        const records = this.store.worker.listCoordinatorInstanceSnapshots(200);
        return {
            generatedAt,
            coordinatorCount: records.length,
            activeCount: records.filter((item) => item.status === "active").length,
            drainingCount: records.filter((item) => item.status === "draining").length,
            offlineCount: records.filter((item) => item.status === "offline").length,
            totalCapacity: records.reduce((sum, item) => sum + item.maxConcurrentDispatches, 0),
            totalActiveDispatchCount: records.reduce((sum, item) => sum + item.activeDispatchCount, 0),
            totalBacklogCount: records.reduce((sum, item) => sum + item.backlogCount, 0),
            regions: [...new Set(records.map((item) => item.region))].sort(),
            hotCoordinatorIds: records
                .filter((item) => computeCoordinatorScore(item, {}) >= 1)
                .map((item) => item.coordinatorId)
                .sort(),
        };
    }
    /**
     * Selects the best coordinator for a dispatch request.
     *
     * Evaluates all active coordinators against the request requirements:
     * - Filters out inactive coordinators
     * - Checks queue affinity match
     * - Validates tenant shard coverage
     * - Scores eligible coordinators by load
     * - Uses stable hash for request-level load distribution
     */
    selectCoordinator(input = {}) {
        const records = this.store.worker.listCoordinatorInstanceSnapshots(200);
        const evaluations = records.map((record) => {
            if (record.status !== "active") {
                return {
                    coordinatorId: record.coordinatorId,
                    eligible: false,
                    score: null,
                    reasonCode: "coordinator_inactive",
                };
            }
            if (input.queueName != null && record.queueAffinity != null && record.queueAffinity !== input.queueName) {
                return {
                    coordinatorId: record.coordinatorId,
                    eligible: false,
                    score: null,
                    reasonCode: "queue_affinity_mismatch",
                };
            }
            const shards = readShards(record);
            if (input.tenantId != null && shards.length > 0 && !shards.includes(input.tenantId)) {
                return {
                    coordinatorId: record.coordinatorId,
                    eligible: false,
                    score: null,
                    reasonCode: "tenant_shard_mismatch",
                };
            }
            return {
                coordinatorId: record.coordinatorId,
                eligible: true,
                score: Number(computeCoordinatorScore(record, input).toFixed(4)),
                reasonCode: null,
            };
        });
        const eligible = evaluations
            .filter((item) => item.eligible)
            .map((item) => ({
            evaluation: item,
            record: records.find((record) => record.coordinatorId === item.coordinatorId),
        }));
        if (eligible.length === 0) {
            return {
                outcome: "no_candidate",
                selectedCoordinatorId: null,
                reasonCode: "no_active_coordinator",
                evaluations,
            };
        }
        const requestBias = stableHash(`${input.requestKey ?? ""}|${input.queueName ?? ""}|${input.preferredRegion ?? ""}|${input.tenantId ?? ""}`);
        eligible.sort((left, right) => {
            const leftScore = left.evaluation.score ?? Number.POSITIVE_INFINITY;
            const rightScore = right.evaluation.score ?? Number.POSITIVE_INFINITY;
            if (leftScore !== rightScore) {
                return leftScore - rightScore;
            }
            const leftBias = stableHash(`${left.record.coordinatorId}|${requestBias}`);
            const rightBias = stableHash(`${right.record.coordinatorId}|${requestBias}`);
            if (leftBias !== rightBias) {
                return leftBias - rightBias;
            }
            return left.record.coordinatorId.localeCompare(right.record.coordinatorId);
        });
        return {
            outcome: "selected",
            selectedCoordinatorId: eligible[0].record.coordinatorId,
            reasonCode: null,
            evaluations,
        };
    }
}
//# sourceMappingURL=coordinator-load-balancing-service.js.map