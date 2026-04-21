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
const DEFAULT_POLICY = {
    maxQueuedTasks: 5,
    maxActiveExecutions: 10,
    maxTier1AckBacklog: 25,
    urgentQueueHeadroom: 2,
};
function isPriorityElevated(priority) {
    return priority === "high" || priority === "urgent";
}
export class AdmissionController {
    store;
    policy;
    backpressureSnapshot;
    constructor(store, policy = DEFAULT_POLICY, backpressureSnapshot = null) {
        this.store = store;
        this.policy = policy;
        this.backpressureSnapshot = backpressureSnapshot;
    }
    snapshot() {
        return {
            queuedTasks: this.store.task.countQueuedTasks(),
            activeExecutions: this.store.execution.countActiveExecutions(),
            tier1AckBacklog: this.store.event.countPendingTier1Acks(),
        };
    }
    evaluate(request) {
        const snapshot = this.snapshot();
        const backpressure = this.backpressureSnapshot?.() ?? null;
        if (request.estimatedCostUsd != null &&
            request.budgetRemainingUsd != null &&
            request.estimatedCostUsd > request.budgetRemainingUsd) {
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
            if (isPriorityElevated(request.priority) &&
                snapshot.queuedTasks < this.policy.maxQueuedTasks + this.policy.urgentQueueHeadroom) {
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
//# sourceMappingURL=admission-controller.js.map