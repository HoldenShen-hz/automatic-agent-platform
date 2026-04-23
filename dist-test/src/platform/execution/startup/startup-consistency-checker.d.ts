/**
 * Startup Consistency Checker
 *
 * @see {@link docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md}
 * @see {@link docs_zh/contracts/runtime_state_machine_contract.md}
 * @see {@link docs_zh/contracts/runtime_execution_contract.md}
 * @see {@link docs_zh/contracts/event_registry_and_ops_threshold_contract.md}
 * @see {@link docs_zh/contracts/file_lock_contract.md}
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 */
import type { ConfigBundle } from "../../control-plane/config-center/config-governance-service.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { listBuiltinToolExecutionMetadata } from "../tool-executor/tool-metadata.js";
import { type ToolContractViolation } from "../tool-executor/tool-contract-validator.js";
export type ConsistencySeverity = "p0" | "p1";
export type StartupReportStatus = "pass" | "repairable" | "fail_closed";
export type RepairActionType = "requeue_execution" | "reconcile_dispatch_ticket" | "reconcile_terminal_state" | "release_stale_lock" | "rebuild_ack" | "close_orphan_session" | "replace_terminal_session" | "manual_intervention_required";
export interface ConsistencyFinding {
    code: "integrity_check_failed" | "schema_outdated" | "migration_checksum_mismatch" | "config_load_failed" | "config_invalid" | "provider_not_ready" | "active_task_missing_workflow" | "invalid_step_index" | "stale_execution" | "orphan_queue_claim" | "terminal_execution_ticket" | "workflow_terminal_state_mismatch" | "orphan_session" | "active_task_terminal_session" | "expired_file_lock" | "tier1_ack_backlog" | "active_execution_conflict" | "event_schema_missing" | "event_consumer_mismatch" | "tool_contract_invalid";
    severity: ConsistencySeverity;
    message: string;
    entityType: "database" | "config" | "provider" | "task" | "workflow" | "execution" | "ticket" | "session" | "file_lock" | "event" | "tool";
    entityId: string;
}
export interface RepairAction {
    action: RepairActionType;
    reasonCode: ConsistencyFinding["code"];
    targetType: ConsistencyFinding["entityType"];
    targetId: string;
}
export interface StartupConsistencyReport {
    checkedAt: string;
    status: StartupReportStatus;
    findings: ConsistencyFinding[];
    repairActions: RepairAction[];
}
export interface StartupConsistencyOptions {
    now?: string;
    staleExecutionAfterMs?: number;
    pendingAckOlderThanMs?: number;
}
export interface StartupConfigValidationResult {
    ok: boolean;
    environment: string;
    configRoot: string | null;
    issues: string[];
    bundle: ConfigBundle | null;
}
export interface ProviderReadinessResult {
    provider: string;
    ready: boolean;
    reasonCode: string;
    message: string;
}
export interface StartupConsistencyCheckerOptions {
    toolMetadataValidator?: (metadataItems: ReturnType<typeof listBuiltinToolExecutionMetadata>) => ToolContractViolation[];
    configValidator?: () => StartupConfigValidationResult;
    providerReadinessProbe?: (configValidation: StartupConfigValidationResult | null) => ProviderReadinessResult[];
}
export declare class StartupConsistencyChecker {
    private readonly db;
    private readonly store;
    private readonly options;
    private readonly dispatchReconciliation;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: StartupConsistencyCheckerOptions);
    run(options?: StartupConsistencyOptions): StartupConsistencyReport;
}
