/**
 * Stalled Execution Detector
 *
 * Monitors active executions and detects those that may be stalled or unresponsive.
 * Uses heartbeat timestamps and progress indicators to identify executions
 * that require intervention (lease reclaim or restart/escalation).
 *
 * Detection criteria:
 * - An execution is considered stale if no progress has been made within a configurable threshold
 * - Missing heartbeat detection triggers lease reclaim recommendations
 * - No progress detection triggers restart/escalation recommendations
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/runtime_execution_contract.md | Runtime Execution Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/task_lease_and_fencing_contract.md | Task Lease and Fencing Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
import type { ExecutionStatus } from "../../contracts/types/status.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
export interface StalledExecutionDetectionOptions {
    now?: string;
    staleAfterMs?: number;
    heartbeatGraceMs?: number;
}
export interface StalledExecutionFinding {
    executionId: string;
    taskId: string;
    agentId: string;
    status: ExecutionStatus;
    lastProgressAt: string;
    lastHeartbeatAt: string | null;
    staleKind: "missing_heartbeat" | "no_progress";
    recommendedAction: "lease_reclaim" | "restart_or_escalate";
}
export declare class StalledExecutionDetector {
    private readonly store;
    constructor(store: AuthoritativeTaskStore);
    detect(options?: StalledExecutionDetectionOptions): StalledExecutionFinding[];
}
