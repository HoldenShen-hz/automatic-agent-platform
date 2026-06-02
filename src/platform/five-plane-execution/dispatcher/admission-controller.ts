/**
 * Admission Controller
 *
 * Enforces admission policies for task execution, ensuring the system remains
 * within operational limits. Evaluates incoming task requests against:
 * - Queue depth limits (max queued tasks, urgent queue headroom)
 * - Active execution capacity
 * - Tier 1 acknowledgment backlog thresholds
 * - Budget constraints
 *
 * Provides decisions: allow (execute immediately), queue (wait for capacity), or reject.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/runtime_execution_contract.md | Runtime Execution Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/task_and_workflow_contract.md | Task and Workflow Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */

import type { TaskPriority } from "../../contracts/types/domain.js";
import type { HealthStatusReport } from "../../shared/observability/health-service.js";

import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";

export interface AdmissionPolicy {
  maxQueuedTasks: number;
  maxActiveExecutions: number;
  maxTier1AckBacklog: number;
  urgentQueueHeadroom: number;
  criticalQueueHeadroom?: number;
  riskClassIsolationEnabled?: boolean;
  maxRiskClassTasks?: Partial<Record<"low" | "medium" | "high" | "critical", number>>;
  tenantQuotaEnabled?: boolean;
  tenantTaskQuota?: number;
  sandboxMatchingEnabled?: boolean;
  sandboxAvailability?: Record<string, number>;
  capabilityClassGateEnabled?: boolean;
  capabilityClassCapacity?: Record<string, number>;
}

export interface AdmissionSnapshot {
  queuedTasks: number;
  activeExecutions: number;
  tier1AckBacklog: number;
  riskClassDistribution: Record<string, number>;
  tenantUsage: Record<string, number>;
  sandboxAvailability: Record<string, number>;
  capabilityClassCapacity: Record<string, number>;
}

export interface AdmissionRequest {
  priority: TaskPriority;
  estimatedCostUsd?: number | null;
  budgetRemainingUsd?: number | null;
  budgetReservationId?: string | null;
  tenantId?: string | null;
  // R6-3: Risk class for isolation routing per §39.6
  riskClass?: "low" | "medium" | "high" | "critical" | null;
  // R6-3: Required sandbox type for this execution
  requiredSandboxType?: string | null;
  sandboxType?: string | null;
  // R6-3: Tenant quota reference for resource governance
  tenantQuotaRef?: string | null;
  // R6-3: Required capability class for worker matching
  capabilityClass?: string | null;
  requiredCapabilities?: readonly string[] | null;
  // R6-3: Risk class derived from task - for scheduling factor evaluation
  taskRiskClass?: "low" | "medium" | "high" | "critical" | null;
}

export interface AdmissionBackpressureSnapshot {
  status: HealthStatusReport["status"];
  degradationMode: HealthStatusReport["degradationMode"];
  queueGovernance: HealthStatusReport["queueGovernance"];
  findings: string[];
}

export interface AdmissionDecision {
  decision: "allow" | "queue" | "reject";
  reasonCode:
    | "admission.ok"
    | "admission.queue_backpressure"
    | "admission.queue_overloaded"
    | "admission.reject_read_only_mode"
    | "admission.reject_non_critical_paused"
    | "admission.reject_starvation_protection"
    | "admission.reject_queue_saturated"
    | "admission.reject_tier1_backlog"
    | "admission.reject_budget_exceeded"
    | "admission.reject_missing_risk_class"
    | "admission.reject_risk_class_isolation"
    | "admission.reject_tenant_quota"
    | "admission.reject_sandbox_matching"
    | "admission.reject_capability_class";
  snapshot: AdmissionSnapshot;
  backpressure: AdmissionBackpressureSnapshot | null;
}

export interface AdmissionControllerOptions {
  snapshotTtlMs?: number;
  reservationTtlMs?: number;
  sandboxAvailabilityProvider?: () => Record<string, number>;
  nowMs?: () => number;
}

const DEFAULT_POLICY: AdmissionPolicy = {
  maxQueuedTasks: 5,
  maxActiveExecutions: 10,
  maxTier1AckBacklog: 25,
  urgentQueueHeadroom: 2,
  criticalQueueHeadroom: 2,
  riskClassIsolationEnabled: true,
  tenantQuotaEnabled: true,
  sandboxMatchingEnabled: true,
  capabilityClassGateEnabled: true,
  maxRiskClassTasks: { critical: 2, high: 5 },
  tenantTaskQuota: 50,
  sandboxAvailability: { standard: 10, hardened: 5, strict: 2 },
  capabilityClassCapacity: { default: 20, sandboxed: 10, privileged: 5 },
};

function isPriorityElevated(priority: TaskPriority): boolean {
  return priority === "high" || priority === "urgent" || priority === "critical";
}

function buildDistribution(values: readonly string[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const value of values) {
    distribution[value] = (distribution[value] ?? 0) + 1;
  }
  return distribution;
}

const DEFAULT_SNAPSHOT_TTL_MS = 100;
const RISK_CLASS_PARSE_CACHE_LIMIT = 2048;

function parseTaskRiskClassFromInputJson(
  inputJson: string,
  cache: Map<string, string | null>,
): string | null {
  const cached = cache.get(inputJson);
  if (cached !== undefined) {
    return cached;
  }
  let parsedRiskClass: string | null = null;
  try {
    const parsed = JSON.parse(inputJson) as { readonly riskClass?: unknown; readonly riskPreview?: { readonly riskClass?: unknown } };
    const nested = parsed.riskClass ?? parsed.riskPreview?.riskClass;
    parsedRiskClass = typeof nested === "string" && nested.length > 0 ? nested : null;
  } catch {
    parsedRiskClass = null;
  }
  if (cache.size >= RISK_CLASS_PARSE_CACHE_LIMIT) {
    cache.clear();
  }
  cache.set(inputJson, parsedRiskClass);
  return parsedRiskClass;
}

function readTaskRiskClass(
  task: unknown,
  cache: Map<string, string | null>,
): string | null {
  if (task == null || typeof task !== "object") {
    return null;
  }
  const direct = (task as { readonly riskClass?: unknown }).riskClass;
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }
  const inputJson = (task as { readonly inputJson?: unknown }).inputJson;
  if (typeof inputJson !== "string" || inputJson.length === 0) {
    return null;
  }
  return parseTaskRiskClassFromInputJson(inputJson, cache);
}

interface AdmissionReservation {
  readonly queuedSlots: number;
  readonly activeSlots: number;
  readonly riskClass: string | null;
  readonly tenantId: string | null;
  readonly sandboxType: string | null;
  readonly capabilityClass: string | null;
  readonly expiresAtMs: number;
}

interface AdmissionStoreSnapshot {
  readonly computedAtMs: number;
  readonly queuedTasks: number;
  readonly activeExecutions: number;
  readonly tier1AckBacklog: number;
  readonly snapshot: AdmissionSnapshot;
}

function cloneCapacityMap(values: Record<string, number> | undefined, fallback: Record<string, number> | undefined): Record<string, number> {
  return { ...(fallback ?? {}), ...(values ?? {}) };
}

function decrementCapacity(target: Record<string, number>, key: string | null, amount: number): void {
  if (key == null || key.length === 0 || amount <= 0) {
    return;
  }
  target[key] = Math.max(0, (target[key] ?? 0) - amount);
}

export class AdmissionController {
  private readonly snapshotTtlMs: number;
  private readonly reservationTtlMs: number;
  private readonly sandboxAvailabilityProvider: (() => Record<string, number>) | null;
  private readonly nowMs: () => number;
  private cachedSnapshot: AdmissionStoreSnapshot | null = null;
  private readonly reservations = new Map<string, AdmissionReservation>();
  private readonly riskClassParseCache = new Map<string, string | null>();

  public constructor(
    private readonly store: AuthoritativeTaskStore,
    private readonly policy: AdmissionPolicy = DEFAULT_POLICY,
    private readonly backpressureSnapshot: (() => AdmissionBackpressureSnapshot | null) | null = null,
    options: AdmissionControllerOptions = {},
  ) {
    this.snapshotTtlMs = Math.max(0, Math.trunc(options.snapshotTtlMs ?? DEFAULT_SNAPSHOT_TTL_MS));
    this.reservationTtlMs = Math.max(50, Math.trunc(options.reservationTtlMs ?? 5_000));
    this.sandboxAvailabilityProvider = options.sandboxAvailabilityProvider ?? null;
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  public snapshot(): AdmissionSnapshot {
    const now = this.nowMs();
    this.pruneReservations(now);
    const queuedTasks = this.store.task.countQueuedTasks();
    const activeExecutions = this.store.execution.countActiveExecutions();
    const tier1AckBacklog = this.store.event.countPendingTier1Acks();
    if (this.isCachedSnapshotValid({
      now,
      queuedTasks,
      activeExecutions,
      tier1AckBacklog,
    })) {
      return this.buildSnapshotWithReservations(this.cachedSnapshot!.snapshot);
    }

    const tasks = this.store.task.listTasks?.() ?? [];
    const riskClassDistribution = buildDistribution(
      tasks
        .map((task) => readTaskRiskClass(task, this.riskClassParseCache))
        .filter((value): value is string => value != null),
    );
    const tenantUsage = buildDistribution(
      tasks
        .map((task) => typeof task?.tenantId === "string" ? task.tenantId : null)
        .filter((value): value is string => value != null),
    );
    const snapshot: AdmissionSnapshot = {
      queuedTasks,
      activeExecutions,
      tier1AckBacklog,
      riskClassDistribution,
      tenantUsage,
      sandboxAvailability: this.resolveSandboxAvailability(),
      capabilityClassCapacity: cloneCapacityMap(this.policy.capabilityClassCapacity, DEFAULT_POLICY.capabilityClassCapacity),
    };
    this.cachedSnapshot = {
      computedAtMs: now,
      queuedTasks,
      activeExecutions,
      tier1AckBacklog,
      snapshot: this.cloneSnapshot(snapshot),
    };
    return this.buildSnapshotWithReservations(snapshot);
  }

  public evaluate(request: AdmissionRequest): AdmissionDecision {
    const snapshot = this.snapshot();
    const backpressure = this.backpressureSnapshot?.() ?? null;

    const effectiveRiskClass = request.riskClass ?? request.taskRiskClass ?? null;
    if (effectiveRiskClass == null) {
      return {
        decision: "reject",
        reasonCode: "admission.reject_missing_risk_class",
        snapshot,
        backpressure,
      };
    }
    if (this.policy.riskClassIsolationEnabled !== false) {
      const maxRiskClassTasks = {
        critical: 2,
        high: 5,
        medium: 10,
        low: Number.POSITIVE_INFINITY,
        ...(this.policy.maxRiskClassTasks ?? {}),
      };
      const currentRiskClassCount = snapshot.riskClassDistribution[effectiveRiskClass] ?? 0;
      if (currentRiskClassCount >= (maxRiskClassTasks[effectiveRiskClass] ?? Number.POSITIVE_INFINITY)) {
        return {
          decision: "reject",
          reasonCode: "admission.reject_risk_class_isolation",
          snapshot,
          backpressure,
        };
      }
    }

    const effectiveTenantId = request.tenantId ?? request.tenantQuotaRef ?? null;
    if (
      this.policy.tenantQuotaEnabled !== false
      && effectiveTenantId != null
      && (snapshot.tenantUsage[effectiveTenantId] ?? 0) >= (this.policy.tenantTaskQuota ?? 50)
    ) {
      return {
        decision: "reject",
        reasonCode: "admission.reject_tenant_quota",
        snapshot,
        backpressure,
      };
    }

    const requestedSandboxType = request.sandboxType ?? request.requiredSandboxType ?? null;
    if (this.policy.sandboxMatchingEnabled !== false && requestedSandboxType != null) {
      const sandboxAvailability = snapshot.sandboxAvailability;
      if ((sandboxAvailability[requestedSandboxType] ?? 0) <= 0) {
        return {
          decision: "reject",
          reasonCode: "admission.reject_sandbox_matching",
          snapshot,
          backpressure,
        };
      }
    }

    if (this.policy.capabilityClassGateEnabled !== false) {
      const requiredCapabilityClass = this.resolveCapabilityClass(request, snapshot.capabilityClassCapacity);
      if (
        requiredCapabilityClass != null
        && (snapshot.capabilityClassCapacity[requiredCapabilityClass] ?? 0) <= 0
      ) {
        return {
          decision: "reject",
          reasonCode: "admission.reject_capability_class",
          snapshot,
          backpressure,
        };
      }
    }

    if (
      request.estimatedCostUsd != null &&
      request.budgetRemainingUsd != null &&
      request.estimatedCostUsd > request.budgetRemainingUsd
    ) {
      return {
        decision: "reject",
        reasonCode: "admission.reject_budget_exceeded",
        snapshot,
        backpressure,
      };
    }

    if (backpressure?.degradationMode === "read_only_operations_only") {
      return {
        decision: "reject",
        reasonCode: "admission.reject_read_only_mode",
        snapshot,
        backpressure,
      };
    }

    // R6-3: High/critical risk tasks should still be allowed during pause_non_critical
    // since they are elevated priority regardless of backpressure mode
    const isElevatedRisk = effectiveRiskClass === "high" || effectiveRiskClass === "critical";
    if (backpressure?.degradationMode === "pause_non_critical" && !isPriorityElevated(request.priority) && !isElevatedRisk) {
      return {
        decision: "reject",
        reasonCode: "admission.reject_non_critical_paused",
        snapshot,
        backpressure,
      };
    }

    if (backpressure?.queueGovernance.starvationDetected && request.priority === "low") {
      return {
        decision: "reject",
        reasonCode: "admission.reject_starvation_protection",
        snapshot,
        backpressure,
      };
    }

    // R6-3: High/critical risk tasks bypass backpressure queue_only for critical operations
    if (backpressure?.degradationMode === "queue_only" && !isPriorityElevated(request.priority) && !isElevatedRisk) {
      return {
        decision: "queue",
        reasonCode: "admission.queue_backpressure",
        snapshot,
        backpressure,
      };
    }

    if (snapshot.tier1AckBacklog >= this.policy.maxTier1AckBacklog) {
      return {
        decision: "reject",
        reasonCode: "admission.reject_tier1_backlog",
        snapshot,
        backpressure,
      };
    }

    if (snapshot.activeExecutions >= this.policy.maxActiveExecutions) {
      const elevatedHeadroom = this.policy.criticalQueueHeadroom ?? this.policy.urgentQueueHeadroom;
      if (isElevatedRisk && snapshot.activeExecutions < this.policy.maxActiveExecutions + elevatedHeadroom) {
        this.reserveAdmission({
          queuedSlots: 0,
          activeSlots: 1,
          riskClass: effectiveRiskClass,
          tenantId: effectiveTenantId,
          sandboxType: requestedSandboxType,
          capabilityClass: this.resolveCapabilityClass(request, snapshot.capabilityClassCapacity),
        });
        const reservedSnapshot = this.snapshot();
        return {
          decision: "allow",
          reasonCode: "admission.ok",
          snapshot: reservedSnapshot,
          backpressure,
        };
      }
      this.reserveAdmission({
        queuedSlots: 1,
        activeSlots: 0,
        riskClass: effectiveRiskClass,
        tenantId: effectiveTenantId,
        sandboxType: requestedSandboxType,
        capabilityClass: this.resolveCapabilityClass(request, snapshot.capabilityClassCapacity),
      });
      const reservedSnapshot = this.snapshot();
      return {
        decision: "queue",
        reasonCode: "admission.queue_overloaded",
        snapshot: reservedSnapshot,
        backpressure,
      };
    }

    if (snapshot.queuedTasks >= this.policy.maxQueuedTasks) {
      if (
        isPriorityElevated(request.priority) ||
        isElevatedRisk
      ) {
        // R6-3: High/critical risk tasks get urgent queue headroom
        const maxQueueWithHeadroom = this.policy.maxQueuedTasks + (this.policy.criticalQueueHeadroom ?? this.policy.urgentQueueHeadroom);
        if (snapshot.queuedTasks < maxQueueWithHeadroom) {
          this.reserveAdmission({
            queuedSlots: 1,
            activeSlots: 0,
            riskClass: effectiveRiskClass,
            tenantId: effectiveTenantId,
            sandboxType: requestedSandboxType,
            capabilityClass: this.resolveCapabilityClass(request, snapshot.capabilityClassCapacity),
          });
          const reservedSnapshot = this.snapshot();
          return {
            decision: "queue",
            reasonCode: "admission.queue_overloaded",
            snapshot: reservedSnapshot,
            backpressure,
          };
        }
      }

      return {
        decision: "reject",
        reasonCode: "admission.reject_queue_saturated",
        snapshot,
        backpressure,
      };
    }

    this.reserveAdmission({
      queuedSlots: 0,
      activeSlots: 1,
      riskClass: effectiveRiskClass,
      tenantId: effectiveTenantId,
      sandboxType: requestedSandboxType,
      capabilityClass: this.resolveCapabilityClass(request, snapshot.capabilityClassCapacity),
    });
    const reservedSnapshot = this.snapshot();
    return {
      decision: "allow",
      reasonCode: "admission.ok",
      snapshot: reservedSnapshot,
      backpressure,
    };
  }

  private resolveSandboxAvailability(): Record<string, number> {
    const providerAvailability = this.sandboxAvailabilityProvider?.() ?? null;
    if (providerAvailability != null) {
      return cloneCapacityMap(providerAvailability, this.policy.sandboxAvailability ?? DEFAULT_POLICY.sandboxAvailability);
    }
    return cloneCapacityMap(this.policy.sandboxAvailability, DEFAULT_POLICY.sandboxAvailability);
  }

  private resolveCapabilityClass(
    request: AdmissionRequest,
    capabilityClassCapacity: Record<string, number>,
  ): string | null {
    if (request.capabilityClass != null && request.capabilityClass.length > 0) {
      return request.capabilityClass;
    }
    const requiredCapabilities = request.requiredCapabilities ?? [];
    if (requiredCapabilities.length === 1 && capabilityClassCapacity[requiredCapabilities[0]!] !== undefined) {
      return requiredCapabilities[0]!;
    }
    return null;
  }

  private reserveAdmission(input: {
    queuedSlots: number;
    activeSlots: number;
    riskClass: string | null;
    tenantId: string | null;
    sandboxType: string | null;
    capabilityClass: string | null;
  }): void {
    const now = this.nowMs();
    this.pruneReservations(now);
    const reservationId = `${now}:${this.reservations.size + 1}:${input.riskClass ?? "none"}`;
    this.reservations.set(reservationId, {
      ...input,
      expiresAtMs: now + this.reservationTtlMs,
    });
    this.cachedSnapshot = null;
  }

  private pruneReservations(now: number): void {
    let changed = false;
    for (const [reservationId, reservation] of this.reservations.entries()) {
      if (reservation.expiresAtMs <= now) {
        this.reservations.delete(reservationId);
        changed = true;
      }
    }
    if (changed) {
      this.cachedSnapshot = null;
    }
  }

  private applyReservationView(snapshot: AdmissionSnapshot): void {
    for (const reservation of this.reservations.values()) {
      snapshot.queuedTasks += reservation.queuedSlots;
      snapshot.activeExecutions += reservation.activeSlots;
      if (reservation.riskClass != null) {
        snapshot.riskClassDistribution[reservation.riskClass] =
          (snapshot.riskClassDistribution[reservation.riskClass] ?? 0) + reservation.queuedSlots + reservation.activeSlots;
      }
      if (reservation.tenantId != null) {
        snapshot.tenantUsage[reservation.tenantId] =
          (snapshot.tenantUsage[reservation.tenantId] ?? 0) + reservation.queuedSlots + reservation.activeSlots;
      }
      decrementCapacity(snapshot.sandboxAvailability, reservation.sandboxType, reservation.queuedSlots + reservation.activeSlots);
      decrementCapacity(snapshot.capabilityClassCapacity, reservation.capabilityClass, reservation.queuedSlots + reservation.activeSlots);
    }
  }

  private cloneSnapshot(snapshot: AdmissionSnapshot): AdmissionSnapshot {
    return {
      queuedTasks: snapshot.queuedTasks,
      activeExecutions: snapshot.activeExecutions,
      tier1AckBacklog: snapshot.tier1AckBacklog,
      riskClassDistribution: { ...snapshot.riskClassDistribution },
      tenantUsage: { ...snapshot.tenantUsage },
      sandboxAvailability: { ...snapshot.sandboxAvailability },
      capabilityClassCapacity: { ...snapshot.capabilityClassCapacity },
    };
  }

  private buildSnapshotWithReservations(storeSnapshot: AdmissionSnapshot): AdmissionSnapshot {
    const snapshot = this.cloneSnapshot(storeSnapshot);
    this.applyReservationView(snapshot);
    return snapshot;
  }

  private isCachedSnapshotValid(input: {
    readonly now: number;
    readonly queuedTasks: number;
    readonly activeExecutions: number;
    readonly tier1AckBacklog: number;
  }): boolean {
    return this.cachedSnapshot != null
      && this.snapshotTtlMs > 0
      && input.now - this.cachedSnapshot.computedAtMs <= this.snapshotTtlMs
      && this.cachedSnapshot.queuedTasks === input.queuedTasks
      && this.cachedSnapshot.activeExecutions === input.activeExecutions
      && this.cachedSnapshot.tier1AckBacklog === input.tier1AckBacklog;
  }
}

export { DEFAULT_POLICY as DEFAULT_ADMISSION_POLICY };
