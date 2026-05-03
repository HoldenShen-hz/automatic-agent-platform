/**
 * Admission Controller
 *
 * Enforces admission policies for task execution, ensuring the system remains
 * within operational limits. Evaluates incoming task requests against:
 * - Queue depth limits (max queued tasks, critical queue headroom)
 * - Active execution capacity
 * - Tier 1 acknowledgment backlog thresholds
 * - Budget constraints
 * - Risk class isolation routing
 * - Tenant quota limits
 * - Sandbox matching
 * - Capability class gating
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

import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";

export interface AdmissionPolicy {
  maxQueuedTasks: number;
  maxActiveExecutions: number;
  maxTier1AckBacklog: number;
  criticalQueueHeadroom: number;
  // R6-3: §14.2 scheduling factors
  riskClassIsolationEnabled: boolean;
  tenantQuotaEnabled: boolean;
  sandboxMatchingEnabled: boolean;
  capabilityClassGateEnabled: boolean;
  maxRiskClassTasks: Record<string, number>;
  tenantTaskQuota: number;
  // R9-5: §14.2 poison-pill detection - max time a ticket can wait before being considered abandoned
  maxQueueAgeMs: number;
}

export interface AdmissionSnapshot {
  queuedTasks: number;
  activeExecutions: number;
  tier1AckBacklog: number;
  // R6-3: Extended snapshot with scheduling factors
  riskClassDistribution: Record<string, number>;
  tenantUsage: Record<string, number>;
  sandboxAvailability: Record<string, number>;
  capabilityClassCapacity: Record<string, number>;
}

export interface AdmissionRequest {
  priority: TaskPriority;
  riskClass?: string;
  tenantId?: string;
  sandboxType?: string;
  requiredCapabilities?: readonly string[];
  estimatedCostUsd?: number | null;
  budgetRemainingUsd?: number | null;
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
  criticalQueueHeadroom: 2,
  // R6-3: §14.2 scheduling factors - all enabled by default
  riskClassIsolationEnabled: true,
  tenantQuotaEnabled: true,
  sandboxMatchingEnabled: true,
  capabilityClassGateEnabled: true,
  maxRiskClassTasks: {
    critical: 2,
    high: 5,
  },
  tenantTaskQuota: 50,
  // R9-5: §14.2 poison-pill detection - 1 hour max queue time before abandonment
  maxQueueAgeMs: 3600000,
};

function isPriorityElevated(priority: TaskPriority): boolean {
  return priority === "high" || priority === "critical";
}

export class AdmissionController {
  public constructor(
    private readonly store: AuthoritativeTaskStore,
    private readonly policy: AdmissionPolicy = DEFAULT_POLICY,
    private readonly backpressureSnapshot: (() => AdmissionBackpressureSnapshot | null) | null = null,
  ) {}

  public snapshot(): AdmissionSnapshot {
    const base = {
      queuedTasks: this.store.task.countQueuedTasks(),
      activeExecutions: this.store.execution.countActiveExecutions(),
      tier1AckBacklog: this.store.event.countPendingTier1Acks(),
    };

    // R6-3: §14.2 Extended snapshot with scheduling factors
    // Risk class distribution
    const riskClassDistribution: Record<string, number> = {};
    const tasks = this.store.task.listTasks();
    for (const task of tasks) {
      // riskClass not available on TaskRecord - use "unknown" as placeholder
      const rc = "unknown";
      riskClassDistribution[rc] = (riskClassDistribution[rc] ?? 0) + 1;
    }

    // Tenant usage (simplified - would need real tenant tracking)
    const tenantUsage: Record<string, number> = {};
    for (const task of tasks) {
      const tid = task.tenantId ?? "unknown";
      tenantUsage[tid] = (tenantUsage[tid] ?? 0) + 1;
    }

    // Sandbox availability (would be populated from sandbox registry)
    const sandboxAvailability: Record<string, number> = {
      standard: 10,
      hardened: 5,
      strict: 2,
    };

    // Capability class capacity (would be populated from capability registry)
    const capabilityClassCapacity: Record<string, number> = {
      default: 20,
      sandboxed: 10,
      privileged: 5,
    };

    return {
      ...base,
      riskClassDistribution,
      tenantUsage,
      sandboxAvailability,
      capabilityClassCapacity,
    };
  }

  public evaluate(request: AdmissionRequest): AdmissionDecision {
    const snapshot = this.snapshot();
    const backpressure = this.backpressureSnapshot?.() ?? null;

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

    // R6-9 FIX: §14.2 verify active budget reservation exists before dispatch
    // No active reservation = cannot dispatch (must reserve before execute)
    if (!request.budgetReservationId || request.budgetReservationId.trim() === "") {
      return {
        decision: "reject",
        reasonCode: "admission.reject_no_budget_reservation",
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

    if (backpressure?.degradationMode === "pause_non_critical" && !isPriorityElevated(request.priority)) {
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

    if (backpressure?.degradationMode === "queue_only" && !isPriorityElevated(request.priority)) {
      return {
        decision: "queue",
        reasonCode: "admission.queue_backpressure",
        snapshot,
        backpressure,
      };
    }

    // R6-3: §14.2 scheduling factors - risk class isolation routing
    if (this.policy.riskClassIsolationEnabled && request.riskClass) {
      const maxForClass = this.policy.maxRiskClassTasks[request.riskClass];
      if (maxForClass != null) {
        const currentCount = snapshot.riskClassDistribution[request.riskClass] ?? 0;
        if (currentCount >= maxForClass) {
          return {
            decision: "reject",
            reasonCode: "admission.reject_risk_class_isolation",
            snapshot,
            backpressure,
          };
        }
      }
    }

    // R6-3: §14.2 scheduling factors - tenant quota
    if (this.policy.tenantQuotaEnabled && request.tenantId) {
      const currentTenantUsage = snapshot.tenantUsage[request.tenantId] ?? 0;
      if (currentTenantUsage >= this.policy.tenantTaskQuota) {
        return {
          decision: "reject",
          reasonCode: "admission.reject_tenant_quota",
          snapshot,
          backpressure,
        };
      }
    }

    // R6-3: §14.2 scheduling factors - sandbox matching
    if (this.policy.sandboxMatchingEnabled && request.sandboxType) {
      const available = snapshot.sandboxAvailability[request.sandboxType] ?? 0;
      if (available <= 0) {
        return {
          decision: "reject",
          reasonCode: "admission.reject_sandbox_matching",
          snapshot,
          backpressure,
        };
      }
    }

    // R6-3: §14.2 scheduling factors - capability class gate
    if (this.policy.capabilityClassGateEnabled && request.requiredCapabilities) {
      for (const cap of request.requiredCapabilities) {
        const capacity = snapshot.capabilityClassCapacity[cap] ?? 0;
        if (capacity <= 0) {
          return {
            decision: "reject",
            reasonCode: "admission.reject_capability_class",
            snapshot,
            backpressure,
          };
        }
      }
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
      return {
        decision: "queue",
        reasonCode: "admission.queue_overloaded",
        snapshot,
        backpressure,
      };
    }

    if (snapshot.queuedTasks >= this.policy.maxQueuedTasks) {
      if (
        isPriorityElevated(request.priority) &&
        snapshot.queuedTasks < this.policy.maxQueuedTasks + this.policy.criticalQueueHeadroom
      ) {
        return {
          decision: "queue",
          reasonCode: "admission.queue_overloaded",
          snapshot,
          backpressure,
        };
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
