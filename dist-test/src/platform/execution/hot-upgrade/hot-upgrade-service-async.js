/**
 * @fileoverview Hot Upgrade Service (Async)
 *
 * Async version of HotUpgradeService that uses HotUpgradeRepository for data access.
 * Provides true zero-downtime upgrade orchestration with async/await support.
 *
 * @see docs_zh/contracts/ha_coordinator_and_leader_election_contract.md
 * @see docs_zh/contracts/task_lease_and_fencing_contract.md
 * @see docs_zh/contracts/release_rollout_and_rollback_contract.md
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
// ── Constants ────────────────────────────────────────────────────────
const DEFAULT_CANARY_PERCENT = 10;
const DEFAULT_CANARY_BATCHES = 3;
const DEFAULT_BATCH_SIZE = 33;
const DEFAULT_MAX_UPGRADE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export class HotUpgradeServiceAsync {
    db;
    repo;
    defaultPolicy;
    constructor(db, repo, options) {
        this.db = db;
        this.repo = repo;
        this.defaultPolicy = {
            canaryPercent: options?.defaultPolicy?.canaryPercent ?? DEFAULT_CANARY_PERCENT,
            canaryBatches: options?.defaultPolicy?.canaryBatches ?? DEFAULT_CANARY_BATCHES,
            batchSize: options?.defaultPolicy?.batchSize ?? DEFAULT_BATCH_SIZE,
            healthGates: options?.defaultPolicy?.healthGates ?? this.buildDefaultHealthGates(),
            rollbackOnFailure: options?.defaultPolicy?.rollbackOnFailure ?? true,
            maxUpgradeDurationMs: options?.defaultPolicy?.maxUpgradeDurationMs ?? DEFAULT_MAX_UPGRADE_DURATION_MS,
            compatibilityCheckEnabled: options?.defaultPolicy?.compatibilityCheckEnabled ?? true,
        };
    }
    // ── Version Compatibility ───────────────────────────────────────────
    async registerVersionCompatibility(compat) {
        await this.repo.upsertVersionCompatibility({
            fromVersion: compat.fromVersion,
            toVersion: compat.toVersion,
            compatibilityLevel: compat.compatibilityLevel,
            migrationRequired: compat.migrationRequired,
            rollbackSupported: compat.rollbackSupported,
        });
    }
    async getVersionCompatibility(fromVersion, toVersion) {
        return this.repo.getVersionCompatibility(fromVersion, toVersion);
    }
    async isUpgradeSafe(fromVersion, toVersion) {
        const compat = await this.getVersionCompatibility(fromVersion, toVersion);
        if (!compat) {
            return {
                safe: false,
                compatibilityLevel: "incompatible",
                requiresMigration: false,
                supportsRollback: false,
                reasonCode: "no_compatibility_record",
            };
        }
        const safe = compat.compatibilityLevel !== "incompatible";
        return {
            safe,
            compatibilityLevel: compat.compatibilityLevel,
            requiresMigration: compat.migrationRequired,
            supportsRollback: compat.rollbackSupported,
            reasonCode: `compatibility_level_${compat.compatibilityLevel}`,
        };
    }
    // ── Upgrade Planning ───────────────────────────────────────────────
    async createUpgradePlan(upgradeId, targets, policy) {
        const mergedPolicy = { ...this.defaultPolicy, ...policy };
        const batches = this.computeBatches(upgradeId, targets, mergedPolicy);
        const plan = {
            planId: newId("upln"),
            upgradeId,
            createdAt: nowIso(),
            targets,
            batches,
            policy: mergedPolicy,
            currentPhase: "canary",
            status: "pending",
            startedAt: null,
            completedAt: null,
            rollbackTriggeredAt: null,
            rollbackReason: null,
        };
        await this.db.transaction(async (conn) => {
            await this.repo.insertUpgradePlan(plan);
            // Insert individual batch records
            for (const batch of batches) {
                await this.repo.insertUpgradeBatch(batch);
            }
        });
        return plan;
    }
    async getUpgradePlan(planId) {
        return this.repo.getUpgradePlan(planId);
    }
    async getUpgradePlansByStatus(status) {
        return this.repo.listUpgradePlansByStatus(status);
    }
    computeBatches(upgradeId, targets, policy) {
        const batches = [];
        const canaryBatchSize = Math.max(1, Math.floor(targets.length * policy.canaryPercent / 100));
        const remainingTargets = [...targets];
        // Canary batches
        for (let i = 0; i < policy.canaryBatches && remainingTargets.length > 0; i++) {
            const batchSize = Math.min(canaryBatchSize, remainingTargets.length);
            const batchTargets = remainingTargets.splice(0, batchSize);
            batches.push({
                batchId: newId("ubatch"),
                upgradeId,
                batchNumber: i + 1,
                targetNodes: batchTargets.map((t) => t.targetId),
                targetVersion: batchTargets[0]?.targetVersion ?? "",
                startedAt: "",
                completedAt: null,
                status: "pending",
                healthChecks: [],
            });
        }
        // Remaining batches
        let batchNumber = policy.canaryBatches + 1;
        while (remainingTargets.length > 0) {
            const batchSize = Math.min(policy.batchSize, remainingTargets.length);
            const batchTargets = remainingTargets.splice(0, batchSize);
            batches.push({
                batchId: newId("ubatch"),
                upgradeId,
                batchNumber: batchNumber++,
                targetNodes: batchTargets.map((t) => t.targetId),
                targetVersion: batchTargets[0]?.targetVersion ?? "",
                startedAt: "",
                completedAt: null,
                status: "pending",
                healthChecks: [],
            });
        }
        return batches;
    }
    // ── Upgrade Execution ───────────────────────────────────────────────
    async startUpgrade(planId) {
        return this.db.transaction(async () => {
            const plan = await this.getUpgradePlan(planId);
            if (!plan) {
                return { started: false, upgradeId: null, firstBatch: null, reasonCode: "plan_not_found" };
            }
            if (plan.status !== "pending") {
                return { started: false, upgradeId: plan.upgradeId, firstBatch: null, reasonCode: "upgrade_not_pending" };
            }
            const now = nowIso();
            await this.repo.updateUpgradePlanStatus(planId, "in_progress", { startedAt: now });
            const firstBatch = plan.batches.find((b) => b.status === "pending");
            if (firstBatch) {
                await this.startBatch(firstBatch.batchId);
            }
            await this.recordAudit(plan.upgradeId, "upgrade_started", "system", `Upgrade ${plan.upgradeId} started`, {});
            return {
                started: true,
                upgradeId: plan.upgradeId,
                firstBatch: firstBatch ?? null,
                reasonCode: null,
            };
        });
    }
    async startBatch(batchId) {
        return this.db.transaction(async () => {
            const batch = await this.repo.getUpgradeBatch(batchId);
            if (!batch) {
                return { started: false, batch: null, reasonCode: "batch_not_found" };
            }
            if (batch.status !== "pending") {
                return { started: false, batch, reasonCode: "batch_not_pending" };
            }
            const now = nowIso();
            const updatedBatch = {
                ...batch,
                status: "in_progress",
                startedAt: now,
                healthChecks: [],
            };
            await this.repo.updateUpgradeBatch(batchId, "in_progress", now, []);
            const plan = await this.getUpgradePlanByBatch(batchId);
            if (plan) {
                await this.recordAudit(plan.upgradeId, "batch_started", "system", `Batch ${batch.batchNumber} started`, { batchId });
            }
            return { started: true, batch: updatedBatch, reasonCode: null };
        });
    }
    async completeBatch(batchId, healthChecks) {
        return this.db.transaction(async () => {
            const batch = await this.repo.getUpgradeBatch(batchId);
            if (!batch) {
                return { completed: false, batch: null, allPassed: false, nextBatch: null, triggerRollback: false };
            }
            const allPassed = healthChecks.every((c) => c.passed);
            const now = nowIso();
            const batchStatus = allPassed ? "completed" : "failed";
            await this.repo.updateUpgradeBatch(batchId, batchStatus, now, healthChecks);
            const plan = await this.getUpgradePlanByBatch(batchId);
            if (!plan) {
                return { completed: allPassed, batch: { ...batch, status: batchStatus, completedAt: now, healthChecks }, allPassed, nextBatch: null, triggerRollback: false };
            }
            // Find next pending batch
            const batches = await this.repo.listUpgradeBatchesByPlan(plan.upgradeId);
            const nextBatch = batches.find((b) => b.batchNumber > batch.batchNumber && b.status === "pending") ?? null;
            // Determine if rollback should be triggered
            let triggerRollback = false;
            if (!allPassed) {
                await this.repo.updateUpgradePlanStatus(plan.planId, "failed", {
                    rollbackTriggeredAt: now,
                    rollbackReason: "health_check_failed",
                });
                if (plan.policy.rollbackOnFailure) {
                    triggerRollback = true;
                    await this.recordAudit(plan.upgradeId, "rollback_triggered", "system", `Rollback triggered due to batch ${batch.batchNumber} health check failure`, { batchId });
                }
                else {
                    await this.recordAudit(plan.upgradeId, "upgrade_failed", "system", `Upgrade failed due to batch ${batch.batchNumber} health check failure (rollback disabled)`, { batchId });
                }
            }
            else if (!nextBatch) {
                // All batches complete successfully
                await this.repo.updateUpgradePlanStatus(plan.planId, "completed", { completedAt: now });
                await this.recordAudit(plan.upgradeId, "upgrade_completed", "system", `Upgrade ${plan.upgradeId} completed successfully`, {});
            }
            if (nextBatch && allPassed) {
                await this.startBatch(nextBatch.batchId);
            }
            return {
                completed: true,
                batch: { ...batch, status: batchStatus, completedAt: now, healthChecks },
                allPassed,
                nextBatch,
                triggerRollback,
            };
        });
    }
    async triggerRollback(upgradeId, reason, message) {
        return this.db.transaction(async () => {
            const trigger = {
                triggerId: newId("rbt"),
                upgradeId,
                reasonCode: reason,
                message,
                detectedAt: nowIso(),
                metadata: {},
            };
            await this.repo.insertRollbackTrigger(trigger);
            await this.repo.updateUpgradePlanStatus(upgradeId, "failed", {
                rollbackTriggeredAt: trigger.detectedAt,
                rollbackReason: message,
            });
            await this.recordAudit(upgradeId, "rollback_triggered", "system", message, { reasonCode: reason });
            return { triggered: true, triggerRecord: trigger };
        });
    }
    async getUpgradeProgress(upgradeId) {
        const plans = await this.repo.listUpgradePlansByStatus("in_progress");
        const plan = plans.find((p) => p.upgradeId === upgradeId);
        if (!plan) {
            // Try to find by upgradeId directly
            const allPlans = await this.repo.listUpgradePlansByStatus("pending");
            const pendingPlan = allPlans.find((p) => p.upgradeId === upgradeId);
            if (!pendingPlan)
                return null;
        }
        const foundPlan = plan;
        const batches = await this.repo.listUpgradeBatchesByPlan(upgradeId);
        const completedBatches = batches.filter((b) => b.status === "completed").length;
        const failedBatches = batches.filter((b) => b.status === "failed").length;
        const allHealthChecks = batches.flatMap((b) => b.healthChecks);
        const healthCheckPassRate = allHealthChecks.length > 0
            ? (allHealthChecks.filter((c) => c.passed).length / allHealthChecks.length) * 100
            : 100;
        // Estimate completion based on duration so far
        let estimatedCompletionMs = null;
        if (foundPlan.startedAt && foundPlan.status === "in_progress") {
            const elapsedMs = Date.now() - new Date(foundPlan.startedAt).getTime();
            const completedRatio = completedBatches / batches.length;
            if (completedRatio > 0) {
                estimatedCompletionMs = Math.round(elapsedMs / completedRatio - elapsedMs);
            }
        }
        return {
            upgradeId,
            phase: foundPlan.currentPhase,
            status: foundPlan.status,
            currentBatchNumber: batches.find((b) => b.status === "in_progress")?.batchNumber ?? 0,
            totalBatches: batches.length,
            completedBatches,
            failedBatches,
            healthCheckPassRate: Math.round(healthCheckPassRate * 100) / 100,
            errorRate: batches.length > 0 ? (failedBatches / batches.length) * 100 : 0,
            estimatedCompletionMs,
        };
    }
    // ── Audit Trail ───────────────────────────────────────────────────
    async recordAudit(upgradeId, eventType, actor, message, details) {
        const entry = {
            id: newId("uaudit"),
            upgradeId,
            eventType,
            actor,
            message,
            details,
            occurredAt: nowIso(),
        };
        await this.repo.insertUpgradeAudit(entry);
    }
    async getUpgradeAuditLog(upgradeId, limit = 100) {
        const entries = await this.repo.listUpgradeAudits(upgradeId, limit);
        return entries.map((e) => ({
            eventType: e.eventType,
            actor: e.actor,
            message: e.message,
            occurredAt: e.occurredAt,
        }));
    }
    // ── Helpers ───────────────────────────────────────────────────────
    buildDefaultHealthGates() {
        const gates = [
            { gateType: "worker_ready", threshold: 0.95, windowSeconds: 60, operator: "gte" },
            { gateType: "dispatch_healthy", threshold: 0.99, windowSeconds: 120, operator: "gte" },
            { gateType: "lease_stable", threshold: 0.98, windowSeconds: 60, operator: "gte" },
            { gateType: "error_rate", threshold: 5, windowSeconds: 300, operator: "lt" },
            { gateType: "latency_pct", threshold: 500, windowSeconds: 120, operator: "lt" },
        ];
        return gates;
    }
    async getUpgradePlanByBatch(batchId) {
        const batch = await this.repo.getUpgradeBatch(batchId);
        if (!batch)
            return null;
        const plans = await this.repo.listUpgradePlansByStatus("in_progress");
        return plans.find((p) => p.upgradeId === batch.upgradeId) ?? null;
    }
}
//# sourceMappingURL=hot-upgrade-service-async.js.map