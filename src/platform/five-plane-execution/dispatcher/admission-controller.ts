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
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/runtime_execution_contract.md | Runtime Execution Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/task_and_workflow_contract.md | Task and Workflow Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
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
    | "admission.reject_risk_class_isolation"
    | "admission.reject_tenant_quota"
    | "admission.reject_sandbox_matching"
    | "admission.reject_capability_class";
  snapshot: AdmissionSnapshot;
  backpressure: AdmissionBackpressureSnapshot | null;
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

function readTaskRiskClass(task: unknown): string | null {
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
  try {
    const parsed = JSON.parse(inputJson) as { readonly riskClass?: unknown; readonly riskPreview?: { readonly riskClass?: unknown } };
    const nested = parsed.riskClass ?? parsed.riskPreview?.riskClass;
    return typeof nested === "string" && nested.length > 0 ? nested : null;
  } catch {
    return null;
  }
}

export class AdmissionController {
  public constructor(
    private readonly store: AuthoritativeTaskStore,
    private readonly policy: AdmissionPolicy = DEFAULT_POLICY,
    private readonly backpressureSnapshot: (() => AdmissionBackpressureSnapshot | null) | null = null,
  ) {}

  public snapshot(): AdmissionSnapshot {
    const tasks = this.store.task.listTasks?.() ?? [];
    const riskClassDistribution = buildDistribution(
      tasks
        .map((task) => readTaskRiskClass(task))
        .filter((value): value is string => value != null),
    );
    const tenantUsage = buildDistribution(
      tasks
        .map((task) => typeof task?.tenantId === "string" ? task.tenantId : null)
        .filter((value): value is string => value != null),
    );
    return {
      queuedTasks: this.store.task.countQueuedTasks(),
      activeExecutions: this.store.execution.countActiveExecutions(),
      tier1AckBacklog: this.store.event.countPendingTier1Acks(),
      riskClassDistribution,
      tenantUsage,
      sandboxAvailability: { ...(this.policy.sandboxAvailability ?? DEFAULT_POLICY.sandboxAvailability) },
      capabilityClassCapacity: { ...(this.policy.capabilityClassCapacity ?? DEFAULT_POLICY.capabilityClassCapacity) },
    };
  }

  public evaluate(request: AdmissionRequest): AdmissionDecision {
    const snapshot = this.snapshot();
    const backpressure = this.backpressureSnapshot?.() ?? null;

    const effectiveRiskClass = request.riskClass ?? request.taskRiskClass ?? "low";
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
      const requiredCapabilities = request.requiredCapabilities
        ?? (request.capabilityClass != null ? [request.capabilityClass] : []);
      for (const capability of requiredCapabilities) {
        if ((snapshot.capabilityClassCapacity[capability] ?? 0) <= 0) {
          return {
            decision: "reject",
            reasonCode: "admission.reject_capability_class",
            snapshot,
            backpressure,
          };
        }
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
      // R6-3: High/critical risk tasks get headroom even when at capacity
      if (isElevatedRisk && snapshot.queuedTasks < this.policy.maxQueuedTasks + (this.policy.criticalQueueHeadroom ?? this.policy.urgentQueueHeadroom)) {
        return {
          decision: "queue",
          reasonCode: "admission.queue_overloaded",
          snapshot,
          backpressure,
        };
      }
      return {
        decision: "queue",
        reasonCode: "admission.queue_overloaded",
        snapshot,
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
          return {
            decision: "queue",
            reasonCode: "admission.queue_overloaded",
            snapshot,
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

    return {
      decision: "allow",
      reasonCode: "admission.ok",
      snapshot,
      backpressure,
    };
  }
}

export { DEFAULT_POLICY as DEFAULT_ADMISSION_POLICY };
