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
}
export interface AdmissionBackpressureSnapshot {
    status: HealthStatusReport["status"];
    degradationMode: HealthStatusReport["degradationMode"];
    queueGovernance: HealthStatusReport["queueGovernance"];
    findings: string[];
}
export interface AdmissionDecision {
    decision: "allow" | "queue" | "reject";
    reasonCode: "admission.ok" | "admission.queue_backpressure" | "admission.queue_overloaded" | "admission.reject_read_only_mode" | "admission.reject_non_critical_paused" | "admission.reject_starvation_protection" | "admission.reject_queue_saturated" | "admission.reject_tier1_backlog" | "admission.reject_budget_exceeded";
    snapshot: AdmissionSnapshot;
    backpressure: AdmissionBackpressureSnapshot | null;
}
declare const DEFAULT_POLICY: AdmissionPolicy;
export declare class AdmissionController {
    private readonly store;
    private readonly policy;
    private readonly backpressureSnapshot;
    constructor(store: AuthoritativeTaskStore, policy?: AdmissionPolicy, backpressureSnapshot?: (() => AdmissionBackpressureSnapshot | null) | null);
    snapshot(): AdmissionSnapshot;
    evaluate(request: AdmissionRequest): AdmissionDecision;
}
export { DEFAULT_POLICY as DEFAULT_ADMISSION_POLICY };
