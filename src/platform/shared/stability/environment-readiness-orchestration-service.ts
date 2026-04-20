import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { StableGateTargetStatus, StableGateVerdict } from "./stable-release-gate.js";

export type EnvironmentName = "dev" | "test" | "staging" | "pre-prod" | "prod";
export type EnvironmentComponentType =
  | "provider"
  | "gateway"
  | "sandbox"
  | "worker_fleet"
  | "artifact_store"
  | "notification_channel"
  | "external_service";
export type EnvironmentSecondaryGateName =
  | "network_ready"
  | "webhook_ready"
  | "moderation_ready"
  | "quota_ready"
  | "attestation_ready"
  | "artifact_namespace_ready";
export type EnvironmentDrillType =
  | "backup_restore"
  | "rolling_upgrade"
  | "maintenance_drain"
  | "tenant_gray_rollout"
  | "regional_failover"
  | "worker_reassignment"
  | "queue_repair";
export type EnvironmentDrillStatus = "passed" | "partial" | "failed";
export type EnvironmentSloComparator = "min" | "max";
export type ResourcePoolType = "execution" | "queue" | "artifact" | "sandbox";

export interface EnvironmentReadinessRecord {
  readinessId: string;
  environment: EnvironmentName;
  componentType: EnvironmentComponentType;
  componentId: string;
  credentialReady: boolean;
  secondaryGates: Partial<Record<EnvironmentSecondaryGateName, boolean>>;
  owner: string;
  lastVerifiedAt: string;
  isActive: boolean;
  notes: string | null;
}

export interface EnvironmentReadinessSummary {
  environment: EnvironmentName;
  componentType: EnvironmentComponentType;
  total: number;
  ready: number;
  notReady: number;
  stale: number;
  allReady: boolean;
}

export interface EnvironmentDrillRecord {
  drillId: string;
  environment: EnvironmentName;
  drillType: EnvironmentDrillType;
  status: EnvironmentDrillStatus;
  owner: string;
  verifiedAt: string;
  evidenceRefs: string[];
  notes: string | null;
}

export interface EnvironmentSloRecord {
  sloId: string;
  environment: EnvironmentName;
  metric: string;
  comparator: EnvironmentSloComparator;
  target: number;
  observed: number;
  unit: "ratio" | "ms" | "count";
  measuredAt: string;
  owner: string;
}

export interface EnvironmentResourcePoolRecord {
  poolId: string;
  environment: EnvironmentName;
  poolType: ResourcePoolType;
  region: string;
  totalCapacityUnits: number;
  reservedCapacityUnits: number;
  availableCapacityUnits: number;
  queueDepth: number;
  maxQueueDepth: number;
  failoverReady: boolean;
  admissionReady: boolean;
  owner: string;
  updatedAt: string;
}

export interface EnvironmentPromotionReport {
  reportId: string;
  environment: EnvironmentName;
  targetStatus: StableGateTargetStatus;
  currentStatus: "partial" | "contract_frozen" | "canary" | "tenant_gray" | "production_ready";
  verdict: StableGateVerdict;
  requiredComponentTypes: EnvironmentComponentType[];
  requiredDrills: EnvironmentDrillType[];
  requiredSloMetrics: string[];
  readinessSummaries: EnvironmentReadinessSummary[];
  blockedComponents: EnvironmentReadinessRecord[];
  staleComponents: EnvironmentReadinessRecord[];
  drillFindings: string[];
  sloFindings: string[];
  resourcePoolFindings: string[];
  runbookRefs: string[];
  blockers: string[];
  advisories: string[];
  createdAt: string;
}

export class EnvironmentReadinessOrchestrationService {
  private readonly readinessRecords = new Map<string, EnvironmentReadinessRecord>();
  private readonly drillRecords = new Map<string, EnvironmentDrillRecord>();
  private readonly sloRecords = new Map<string, EnvironmentSloRecord>();
  private readonly resourcePools = new Map<string, EnvironmentResourcePoolRecord>();

  public upsertReadiness(input: {
    environment: EnvironmentName;
    componentType: EnvironmentComponentType;
    componentId: string;
    credentialReady: boolean;
    secondaryGates?: Partial<Record<EnvironmentSecondaryGateName, boolean>> | undefined;
    owner: string;
    lastVerifiedAt?: string | undefined;
    isActive?: boolean | undefined;
    notes?: string | null | undefined;
  }): EnvironmentReadinessRecord {
    const key = `${input.environment}:${input.componentType}:${input.componentId}`;
    const current = this.readinessRecords.get(key);
    const record: EnvironmentReadinessRecord = {
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

  public recordDrill(input: {
    environment: EnvironmentName;
    drillType: EnvironmentDrillType;
    status: EnvironmentDrillStatus;
    owner: string;
    verifiedAt?: string | undefined;
    evidenceRefs?: readonly string[] | undefined;
    notes?: string | null | undefined;
  }): EnvironmentDrillRecord {
    const key = `${input.environment}:${input.drillType}`;
    const current = this.drillRecords.get(key);
    const record: EnvironmentDrillRecord = {
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

  public recordSlo(input: {
    environment: EnvironmentName;
    metric: string;
    comparator: EnvironmentSloComparator;
    target: number;
    observed: number;
    unit?: "ratio" | "ms" | "count" | undefined;
    measuredAt?: string | undefined;
    owner: string;
  }): EnvironmentSloRecord {
    const metric = normalizeRequired(input.metric, "metric");
    const key = `${input.environment}:${metric}`;
    const current = this.sloRecords.get(key);
    const record: EnvironmentSloRecord = {
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

  public upsertResourcePool(input: {
    environment: EnvironmentName;
    poolType: ResourcePoolType;
    region: string;
    totalCapacityUnits: number;
    reservedCapacityUnits: number;
    availableCapacityUnits: number;
    queueDepth: number;
    maxQueueDepth: number;
    failoverReady: boolean;
    admissionReady: boolean;
    owner: string;
    updatedAt?: string | undefined;
  }): EnvironmentResourcePoolRecord {
    const key = `${input.environment}:${input.poolType}:${input.region}`;
    const current = this.resourcePools.get(key);
    const record: EnvironmentResourcePoolRecord = {
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

  public listReadiness(environment?: EnvironmentName): EnvironmentReadinessRecord[] {
    return [...this.readinessRecords.values()]
      .filter((record) => environment == null || record.environment === environment)
      .sort((left, right) => left.componentType.localeCompare(right.componentType) || left.componentId.localeCompare(right.componentId));
  }

  public summarizeEnvironment(input: {
    environment: EnvironmentName;
    staleAfterHours?: number | undefined;
    asOf?: string | undefined;
  }): EnvironmentReadinessSummary[] {
    const activeRecords = this.listReadiness(input.environment).filter((record) => record.isActive);
    const summaries = new Map<EnvironmentComponentType, EnvironmentReadinessSummary>();
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
      } else {
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

  public evaluatePromotion(input: {
    environment: EnvironmentName;
    targetStatus: StableGateTargetStatus;
    staleAfterHours?: number | undefined;
    asOf?: string | undefined;
  }): EnvironmentPromotionReport {
    const staleAfterHours = input.staleAfterHours ?? 24;
    const readinessRecords = this.listReadiness(input.environment).filter((record) => record.isActive);
    if (readinessRecords.length === 0) {
      throw new ValidationError(
        `environment_readiness.missing_registry:${input.environment}`,
        `Environment ${input.environment} does not have any readiness records.`,
      );
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
    const blockers: string[] = [];
    const advisories: string[] = [];

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
        } else {
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
      const issues: string[] = [];
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

  private isReady(record: EnvironmentReadinessRecord): boolean {
    return record.credentialReady && Object.values(record.secondaryGates).every((value) => value !== false);
  }

  private isStale(record: EnvironmentReadinessRecord, staleAfterHours: number, asOf?: string): boolean {
    const reference = asOf == null ? Date.now() : Date.parse(asOf);
    const verifiedAt = Date.parse(record.lastVerifiedAt);
    return reference - verifiedAt > staleAfterHours * 60 * 60 * 1000;
  }

  private sloPasses(record: EnvironmentSloRecord): boolean {
    return record.comparator === "min" ? record.observed >= record.target : record.observed <= record.target;
  }
}

function resolveRequiredComponentTypes(targetStatus: StableGateTargetStatus): EnvironmentComponentType[] {
  if (targetStatus === "production_ready") {
    return ["provider", "gateway", "sandbox", "worker_fleet", "artifact_store", "notification_channel", "external_service"];
  }
  if (targetStatus === "tenant_gray") {
    return ["provider", "gateway", "sandbox", "worker_fleet", "artifact_store", "notification_channel"];
  }
  return ["provider", "gateway", "sandbox", "worker_fleet"];
}

function resolveRequiredDrills(targetStatus: StableGateTargetStatus): EnvironmentDrillType[] {
  if (targetStatus === "production_ready") {
    return ["backup_restore", "rolling_upgrade", "maintenance_drain", "tenant_gray_rollout", "regional_failover", "worker_reassignment", "queue_repair"];
  }
  if (targetStatus === "tenant_gray") {
    return ["backup_restore", "rolling_upgrade", "maintenance_drain", "tenant_gray_rollout"];
  }
  return ["rolling_upgrade", "maintenance_drain"];
}

function resolveRequiredSloMetrics(targetStatus: StableGateTargetStatus): string[] {
  if (targetStatus === "production_ready") {
    return ["task_success_rate", "task_start_latency", "recovery_success_rate", "approval_delivery_availability", "tier1_event_delivery_latency"];
  }
  if (targetStatus === "tenant_gray") {
    return ["task_success_rate", "task_start_latency", "recovery_success_rate", "rollout_success_rate"];
  }
  return ["task_success_rate", "task_start_latency", "rollout_success_rate"];
}

function buildRunbookRefs(blockers: readonly string[]): string[] {
  const refs = new Set<string>();
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

function sanitizeSecondaryGates(
  gates: Partial<Record<EnvironmentSecondaryGateName, boolean>> | undefined,
): Partial<Record<EnvironmentSecondaryGateName, boolean>> {
  return {
    ...(gates?.network_ready == null ? {} : { network_ready: gates.network_ready }),
    ...(gates?.webhook_ready == null ? {} : { webhook_ready: gates.webhook_ready }),
    ...(gates?.moderation_ready == null ? {} : { moderation_ready: gates.moderation_ready }),
    ...(gates?.quota_ready == null ? {} : { quota_ready: gates.quota_ready }),
    ...(gates?.attestation_ready == null ? {} : { attestation_ready: gates.attestation_ready }),
    ...(gates?.artifact_namespace_ready == null ? {} : { artifact_namespace_ready: gates.artifact_namespace_ready }),
  };
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ValidationError(`environment_readiness.invalid_${field}`, `Field ${field} must be non-empty.`);
  }
  return normalized;
}

function normalizeOptional(value: string | null): string | null {
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeFiniteNumber(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new ValidationError(`environment_readiness.invalid_${field}`, `Field ${field} must be finite.`);
  }
  return Number(value.toFixed(4));
}

function normalizeNonNegativeNumber(value: number, field: string): number {
  const normalized = normalizeFiniteNumber(value, field);
  if (normalized < 0) {
    throw new ValidationError(`environment_readiness.invalid_${field}`, `Field ${field} must be non-negative.`);
  }
  return normalized;
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}
