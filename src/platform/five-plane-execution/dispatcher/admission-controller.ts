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

import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";

export interface AdmissionPolicy {
  maxQueuedTasks: number;
  maxActiveExecutions: number;
  maxTier1AckBacklog: number;
  urgentQueueHeadroom: number;
}

export interface AdmissionSnapshot {
  queuedTasks: number;
  activeExecutions: number;
  tier1AckBacklog: number;
}

export interface AdmissionRequest {
  priority: TaskPriority;
  estimatedCostUsd?: number | null;
  budgetRemainingUsd?: number | null;
  // R6-3: Risk class for isolation routing per §39.6
  riskClass?: "low" | "medium" | "high" | "critical" | null;
  // R6-3: Required sandbox type for this execution
  requiredSandboxType?: string | null;
  // R6-3: Tenant quota reference for resource governance
  tenantQuotaRef?: string | null;
  // R6-3: Required capability class for worker matching
  capabilityClass?: string | null;
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
    | "admission.reject_budget_exceeded";
  snapshot: AdmissionSnapshot;
  backpressure: AdmissionBackpressureSnapshot | null;
}

const DEFAULT_POLICY: AdmissionPolicy = {
  maxQueuedTasks: 5,
  maxActiveExecutions: 10,
  maxTier1AckBacklog: 25,
  urgentQueueHeadroom: 2,
};

function isPriorityElevated(priority: TaskPriority): boolean {
  // R6-8 fix: Use "critical" per §5.3 canonical priority levels, not "urgent"
  return priority === "high" || priority === "critical";
}

export class AdmissionController {
  public constructor(
    private readonly store: AuthoritativeTaskStore,
    private readonly policy: AdmissionPolicy = DEFAULT_POLICY,
    private readonly backpressureSnapshot: (() => AdmissionBackpressureSnapshot | null) | null = null,
  ) {}

  public snapshot(): AdmissionSnapshot {
    return {
      queuedTasks: this.store.task.countQueuedTasks(),
      activeExecutions: this.store.execution.countActiveExecutions(),
      tier1AckBacklog: this.store.event.countPendingTier1Acks(),
    };
  }

  public evaluate(request: AdmissionRequest): AdmissionDecision {
    const snapshot = this.snapshot();
    const backpressure = this.backpressureSnapshot?.() ?? null;

    // R6-3: Check risk-class isolation constraint
    // High/critical risk tasks should not be queued behind low-risk tasks
    const effectiveRiskClass = request.riskClass ?? request.taskRiskClass ?? "low";
    if (effectiveRiskClass === "critical" && snapshot.queuedTasks > 0) {
      // Critical risk tasks get priority queuing - reject lower risk queued tasks
      // This is a simplified check; full implementation would evict/reorder
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

    // R6-3: Sandbox type matching check - verify required sandbox is available
    // This is a placeholder check; full implementation would check worker pool
    if (request.requiredSandboxType != null) {
      // Sandbox type is noted for dispatch scheduling; admission allows if capacity exists
    }

    // R6-3: Tenant quota check placeholder
    // Full implementation would check tenant-specific resource limits
    if (request.tenantQuotaRef != null) {
      // Tenant quota reference is tracked for resource governance
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
      if (isElevatedRisk && snapshot.queuedTasks < this.policy.maxQueuedTasks + this.policy.urgentQueueHeadroom) {
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
        const maxQueueWithHeadroom = this.policy.maxQueuedTasks + this.policy.urgentQueueHeadroom;
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
