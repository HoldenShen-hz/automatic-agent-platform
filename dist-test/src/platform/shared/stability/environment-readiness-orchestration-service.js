import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
export class EnvironmentReadinessOrchestrationService {
    readinessRecords = new Map();
    drillRecords = new Map();
    sloRecords = new Map();
    resourcePools = new Map();
    upsertReadiness(input) {
        const key = `${input.environment}:${input.componentType}:${input.componentId}`;
        const current = this.readinessRecords.get(key);
        const record = {
            readinessId: current?.readinessId ?? newId("env_ready"),
            environment: input.environment,
            componentType: input.componentType,
            componentId: normalizeRequired(input.componentId, "componentId"),
            credentialReady: input.credentialReady,
            secondaryGates: sanitizeSecondaryGates(input.secondaryGates),
            owner: normalizeRequired(input.owner, "owner"),
            lastVerifiedAt: input.lastVerifiedAt ?? nowIso(),
            isActive: input.isActive ?? true,
            notes: normalizeOptional(input.notes ?? null),
        };
        this.readinessRecords.set(key, record);
        return record;
    }
    recordDrill(input) {
        const key = `${input.environment}:${input.drillType}`;
        const current = this.drillRecords.get(key);
        const record = {
            drillId: current?.drillId ?? newId("env_drill"),
            environment: input.environment,
            drillType: input.drillType,
            status: input.status,
            owner: normalizeRequired(input.owner, "owner"),
            verifiedAt: input.verifiedAt ?? nowIso(),
            evidenceRefs: dedupeStrings(input.evidenceRefs ?? []),
            notes: normalizeOptional(input.notes ?? null),
        };
        this.drillRecords.set(key, record);
        return record;
    }
    recordSlo(input) {
        const metric = normalizeRequired(input.metric, "metric");
        const key = `${input.environment}:${metric}`;
        const current = this.sloRecords.get(key);
        const record = {
            sloId: current?.sloId ?? newId("env_slo"),
            environment: input.environment,
            metric,
            comparator: input.comparator,
            target: normalizeFiniteNumber(input.target, "target"),
            observed: normalizeFiniteNumber(input.observed, "observed"),
            unit: input.unit ?? "ratio",
            measuredAt: input.measuredAt ?? nowIso(),
            owner: normalizeRequired(input.owner, "owner"),
        };
        this.sloRecords.set(key, record);
        return record;
    }
    upsertResourcePool(input) {
        const key = `${input.environment}:${input.poolType}:${input.region}`;
        const current = this.resourcePools.get(key);
        const record = {
            poolId: current?.poolId ?? newId("env_pool"),
            environment: input.environment,
            poolType: input.poolType,
            region: normalizeRequired(input.region, "region"),
            totalCapacityUnits: normalizeNonNegativeNumber(input.totalCapacityUnits, "totalCapacityUnits"),
            reservedCapacityUnits: normalizeNonNegativeNumber(input.reservedCapacityUnits, "reservedCapacityUnits"),
            availableCapacityUnits: normalizeNonNegativeNumber(input.availableCapacityUnits, "availableCapacityUnits"),
            queueDepth: normalizeNonNegativeNumber(input.queueDepth, "queueDepth"),
            maxQueueDepth: normalizeNonNegativeNumber(input.maxQueueDepth, "maxQueueDepth"),
            failoverReady: input.failoverReady,
            admissionReady: input.admissionReady,
            owner: normalizeRequired(input.owner, "owner"),
            updatedAt: input.updatedAt ?? nowIso(),
        };
        this.resourcePools.set(key, record);
        return record;
    }
    listReadiness(environment) {
        return [...this.readinessRecords.values()]
            .filter((record) => environment == null || record.environment === environment)
            .sort((left, right) => left.componentType.localeCompare(right.componentType) || left.componentId.localeCompare(right.componentId));
    }
    summarizeEnvironment(input) {
        const activeRecords = this.listReadiness(input.environment).filter((record) => record.isActive);
        const summaries = new Map();
        for (const record of activeRecords) {
            const summary = summaries.get(record.componentType) ?? {
                environment: input.environment,
                componentType: record.componentType,
                total: 0,
                ready: 0,
                notReady: 0,
                stale: 0,
                allReady: false,
            };
            summary.total += 1;
            if (this.isReady(record)) {
                summary.ready += 1;
            }
            else {
                summary.notReady += 1;
            }
            if (this.isStale(record, input.staleAfterHours ?? 24, input.asOf)) {
                summary.stale += 1;
            }
            summary.allReady = summary.notReady === 0 && summary.stale === 0 && summary.total > 0;
            summaries.set(record.componentType, summary);
        }
        return [...summaries.values()].sort((left, right) => left.componentType.localeCompare(right.componentType));
    }
    evaluatePromotion(input) {
        const staleAfterHours = input.staleAfterHours ?? 24;
        const readinessRecords = this.listReadiness(input.environment).filter((record) => record.isActive);
        if (readinessRecords.length === 0) {
            throw new ValidationError(`environment_readiness.missing_registry:${input.environment}`, `Environment ${input.environment} does not have any readiness records.`);
        }
        const requiredComponentTypes = resolveRequiredComponentTypes(input.targetStatus);
        const requiredDrills = resolveRequiredDrills(input.targetStatus);
        const requiredSloMetrics = resolveRequiredSloMetrics(input.targetStatus);
        const readinessSummaries = this.summarizeEnvironment({
            environment: input.environment,
            staleAfterHours,
            asOf: input.asOf,
        });
        const blockedComponents = readinessRecords.filter((record) => !this.isReady(record));
        const staleComponents = readinessRecords.filter((record) => this.isStale(record, staleAfterHours, input.asOf));
        const blockers = [];
        const advisories = [];
        for (const componentType of requiredComponentTypes) {
            const candidates = readinessRecords.filter((record) => record.componentType === componentType);
            if (candidates.length === 0) {
                blockers.push(`missing_component_type:${componentType}`);
                continue;
            }
            const hasReady = candidates.some((record) => this.isReady(record) && !this.isStale(record, staleAfterHours, input.asOf));
            if (!hasReady) {
                blockers.push(`component_type_not_ready:${componentType}`);
            }
        }
        const drillFindings = requiredDrills.flatMap((drillType) => {
            const record = this.drillRecords.get(`${input.environment}:${drillType}`) ?? null;
            if (record == null) {
                blockers.push(`missing_drill:${drillType}`);
                return [`missing:${drillType}`];
            }
            if (record.status === "failed") {
                blockers.push(`failed_drill:${drillType}`);
                return [`failed:${drillType}`];
            }
            if (record.status === "partial") {
                const finding = `partial:${drillType}`;
                if (input.targetStatus === "production_ready") {
                    blockers.push(`partial_drill:${drillType}`);
                }
                else {
                    advisories.push(`partial_drill:${drillType}`);
                }
                return [finding];
            }
            return [`passed:${drillType}`];
        });
        const sloFindings = requiredSloMetrics.flatMap((metric) => {
            const record = this.sloRecords.get(`${input.environment}:${metric}`) ?? null;
            if (record == null) {
                blockers.push(`missing_slo:${metric}`);
                return [`missing:${metric}`];
            }
            const passes = this.sloPasses(record);
            if (!passes) {
                blockers.push(`slo_breach:${metric}`);
            }
            return [`${passes ? "passed" : "breached"}:${metric}:${record.observed}`];
        });
        const relevantPools = [...this.resourcePools.values()].filter((record) => record.environment === input.environment);
        const resourcePoolFindings = relevantPools.map((pool) => {
            const issues = [];
            if (!pool.admissionReady) {
                blockers.push(`pool_not_admission_ready:${pool.poolType}:${pool.region}`);
                issues.push("admission_blocked");
            }
            if (pool.availableCapacityUnits <= 0) {
                blockers.push(`pool_no_capacity:${pool.poolType}:${pool.region}`);
                issues.push("no_capacity");
            }
            if (pool.queueDepth > pool.maxQueueDepth) {
                blockers.push(`pool_queue_breach:${pool.poolType}:${pool.region}`);
                issues.push("queue_breach");
            }
            if (input.targetStatus === "production_ready" && !pool.failoverReady) {
                blockers.push(`pool_failover_not_ready:${pool.poolType}:${pool.region}`);
                issues.push("failover_not_ready");
            }
            if (input.targetStatus !== "production_ready" && !pool.failoverReady) {
                advisories.push(`pool_failover_not_ready:${pool.poolType}:${pool.region}`);
            }
            return issues.length === 0 ? `healthy:${pool.poolType}:${pool.region}` : `${pool.poolType}:${pool.region}:${issues.join(",")}`;
        });
        const allReadinessReady = readinessRecords.every((record) => this.isReady(record) && !this.isStale(record, staleAfterHours, input.asOf));
        const allDrillsReady = requiredDrills.every((drillType) => this.drillRecords.get(`${input.environment}:${drillType}`)?.status === "passed");
        const allSlosReady = requiredSloMetrics.every((metric) => {
            const record = this.sloRecords.get(`${input.environment}:${metric}`);
            return record != null && this.sloPasses(record);
        });
        const allPoolsReady = relevantPools.length > 0 && relevantPools.every((pool) => {
            if (!pool.admissionReady || pool.availableCapacityUnits <= 0 || pool.queueDepth > pool.maxQueueDepth) {
                return false;
            }
            return input.targetStatus === "production_ready" ? pool.failoverReady : true;
        });
        const currentStatus = !allReadinessReady
            ? "partial"
            : !allDrillsReady || !allSlosReady || !allPoolsReady
                ? "contract_frozen"
                : input.targetStatus === "production_ready"
                    ? "production_ready"
                    : input.targetStatus === "tenant_gray"
                        ? "tenant_gray"
                        : "canary";
        const verdict = blockers.length === 0
            ? advisories.length === 0 ? "promote_approved" : "conditional"
            : "promote_blocked";
        return {
            reportId: newId("env_promo"),
            environment: input.environment,
            targetStatus: input.targetStatus,
            currentStatus,
            verdict,
            requiredComponentTypes,
            requiredDrills,
            requiredSloMetrics,
            readinessSummaries,
            blockedComponents,
            staleComponents,
            drillFindings,
            sloFindings,
            resourcePoolFindings,
            runbookRefs: buildRunbookRefs(blockers),
            blockers,
            advisories,
            createdAt: nowIso(),
        };
    }
    isReady(record) {
        return record.credentialReady && Object.values(record.secondaryGates).every((value) => value !== false);
    }
    isStale(record, staleAfterHours, asOf) {
        const reference = asOf == null ? Date.now() : Date.parse(asOf);
        const verifiedAt = Date.parse(record.lastVerifiedAt);
        return reference - verifiedAt > staleAfterHours * 60 * 60 * 1000;
    }
    sloPasses(record) {
        return record.comparator === "min" ? record.observed >= record.target : record.observed <= record.target;
    }
}
function resolveRequiredComponentTypes(targetStatus) {
    if (targetStatus === "production_ready") {
        return ["provider", "gateway", "sandbox", "worker_fleet", "artifact_store", "notification_channel", "external_service"];
    }
    if (targetStatus === "tenant_gray") {
        return ["provider", "gateway", "sandbox", "worker_fleet", "artifact_store", "notification_channel"];
    }
    return ["provider", "gateway", "sandbox", "worker_fleet"];
}
function resolveRequiredDrills(targetStatus) {
    if (targetStatus === "production_ready") {
        return ["backup_restore", "rolling_upgrade", "maintenance_drain", "tenant_gray_rollout", "regional_failover", "worker_reassignment", "queue_repair"];
    }
    if (targetStatus === "tenant_gray") {
        return ["backup_restore", "rolling_upgrade", "maintenance_drain", "tenant_gray_rollout"];
    }
    return ["rolling_upgrade", "maintenance_drain"];
}
function resolveRequiredSloMetrics(targetStatus) {
    if (targetStatus === "production_ready") {
        return ["task_success_rate", "task_start_latency", "recovery_success_rate", "approval_delivery_availability", "tier1_event_delivery_latency"];
    }
    if (targetStatus === "tenant_gray") {
        return ["task_success_rate", "task_start_latency", "recovery_success_rate", "rollout_success_rate"];
    }
    return ["task_success_rate", "task_start_latency", "rollout_success_rate"];
}
function buildRunbookRefs(blockers) {
    const refs = new Set();
    for (const blocker of blockers) {
        if (blocker.includes("pool_queue_breach") || blocker.includes("queue_repair")) {
            refs.add("queue_backlog_breach");
        }
        if (blocker.includes("regional_failover") || blocker.includes("worker_reassignment")) {
            refs.add("worker_mass_disconnect");
        }
        if (blocker.includes("slo_breach:task_start_latency")) {
            refs.add("provider_429_or_5xx_spike");
        }
        if (blocker.includes("backup_restore")) {
            refs.add("rollout_blocked_or_rollback");
        }
    }
    if (refs.size === 0) {
        refs.add("rollout_blocked_or_rollback");
    }
    return [...refs];
}
function sanitizeSecondaryGates(gates) {
    return {
        ...(gates?.network_ready == null ? {} : { network_ready: gates.network_ready }),
        ...(gates?.webhook_ready == null ? {} : { webhook_ready: gates.webhook_ready }),
        ...(gates?.moderation_ready == null ? {} : { moderation_ready: gates.moderation_ready }),
        ...(gates?.quota_ready == null ? {} : { quota_ready: gates.quota_ready }),
        ...(gates?.attestation_ready == null ? {} : { attestation_ready: gates.attestation_ready }),
        ...(gates?.artifact_namespace_ready == null ? {} : { artifact_namespace_ready: gates.artifact_namespace_ready }),
    };
}
function normalizeRequired(value, field) {
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new ValidationError(`environment_readiness.invalid_${field}`, `Field ${field} must be non-empty.`);
    }
    return normalized;
}
function normalizeOptional(value) {
    if (value == null) {
        return null;
    }
    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
}
function normalizeFiniteNumber(value, field) {
    if (!Number.isFinite(value)) {
        throw new ValidationError(`environment_readiness.invalid_${field}`, `Field ${field} must be finite.`);
    }
    return Number(value.toFixed(4));
}
function normalizeNonNegativeNumber(value, field) {
    const normalized = normalizeFiniteNumber(value, field);
    if (normalized < 0) {
        throw new ValidationError(`environment_readiness.invalid_${field}`, `Field ${field} must be non-negative.`);
    }
    return normalized;
}
function dedupeStrings(values) {
    return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}
//# sourceMappingURL=environment-readiness-orchestration-service.js.map