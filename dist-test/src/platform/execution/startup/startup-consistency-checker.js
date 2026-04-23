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
import { getRegisteredConsumers, hasEventSchema } from "../../state-evidence/events/event-registry.js";
import { ExecutionDispatchReconciliationService } from "../dispatcher/execution-dispatch-reconciliation-service.js";
import { getWorkflowDefinition } from "../../orchestration/oapeflir/workflow/minimal-workflow.js";
import { listBuiltinToolExecutionMetadata } from "../tool-executor/tool-metadata.js";
import { validateToolMetadataRegistry } from "../tool-executor/tool-contract-validator.js";
function minusMs(isoTimestamp, deltaMs) {
    return new Date(Date.parse(isoTimestamp) - deltaMs).toISOString();
}
function uniqueRepairActions(actions) {
    const seen = new Set();
    return actions.filter((action) => {
        const key = `${action.action}:${action.targetType}:${action.targetId}:${action.reasonCode}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function buildInvalidStepIndexFindings(workflows) {
    return workflows.flatMap((workflow) => {
        const definition = getWorkflowDefinition(workflow.workflowId);
        if (!definition) {
            return [
                {
                    code: "invalid_step_index",
                    severity: "p0",
                    message: `Unknown workflow definition: ${workflow.workflowId}`,
                    entityType: "workflow",
                    entityId: workflow.taskId,
                },
            ];
        }
        const maxIndex = definition.steps.length;
        if (workflow.currentStepIndex < 0 || workflow.currentStepIndex > maxIndex) {
            return [
                {
                    code: "invalid_step_index",
                    severity: "p0",
                    message: `Workflow step index ${workflow.currentStepIndex} is outside 0..${maxIndex}`,
                    entityType: "workflow",
                    entityId: workflow.taskId,
                },
            ];
        }
        return [];
    });
}
function buildExpiredFileLockFinding(lock) {
    return {
        code: "expired_file_lock",
        severity: "p1",
        message: `File lock expired for ${lock.resourcePath}`,
        entityType: "file_lock",
        entityId: lock.id,
    };
}
export class StartupConsistencyChecker {
    db;
    store;
    options;
    dispatchReconciliation;
    constructor(db, store, options = {}) {
        this.db = db;
        this.store = store;
        this.options = options;
        this.dispatchReconciliation = new ExecutionDispatchReconciliationService(db, store);
    }
    run(options = {}) {
        const checkedAt = options.now ?? new Date().toISOString();
        const staleExecutionAfterMs = options.staleExecutionAfterMs ?? 5 * 60 * 1000;
        const pendingAckOlderThanMs = options.pendingAckOlderThanMs ?? 2 * 60 * 1000;
        const findings = [];
        let configValidation = null;
        const toolContractViolations = (this.options.toolMetadataValidator ?? validateToolMetadataRegistry)(listBuiltinToolExecutionMetadata());
        if (this.options.configValidator) {
            try {
                configValidation = this.options.configValidator();
            }
            catch (error) {
                findings.push({
                    code: "config_load_failed",
                    severity: "p0",
                    message: error instanceof Error ? error.message : String(error),
                    entityType: "config",
                    entityId: "startup",
                });
            }
            if (configValidation && (!configValidation.ok || configValidation.issues.length > 0)) {
                findings.push(...configValidation.issues.map((issue) => ({
                    code: configValidation?.bundle == null ? "config_load_failed" : "config_invalid",
                    severity: "p0",
                    message: issue,
                    entityType: "config",
                    entityId: configValidation?.configRoot ?? configValidation?.environment ?? "startup",
                })));
            }
        }
        if (this.options.providerReadinessProbe) {
            try {
                findings.push(...this.options
                    .providerReadinessProbe(configValidation)
                    .filter((result) => !result.ready)
                    .map((result) => ({
                    code: "provider_not_ready",
                    severity: "p0",
                    message: `${result.message} (${result.reasonCode})`,
                    entityType: "provider",
                    entityId: result.provider,
                })));
            }
            catch (error) {
                findings.push({
                    code: "provider_not_ready",
                    severity: "p0",
                    message: error instanceof Error ? error.message : String(error),
                    entityType: "provider",
                    entityId: "default",
                });
            }
        }
        for (const result of this.db.integrityCheck()) {
            if (result !== "ok") {
                findings.push({
                    code: "integrity_check_failed",
                    severity: "p0",
                    message: result,
                    entityType: "database",
                    entityId: "sqlite",
                });
            }
        }
        findings.push(...toolContractViolations.map((violation) => ({
            code: "tool_contract_invalid",
            severity: "p0",
            message: violation.message,
            entityType: "tool",
            entityId: violation.toolName,
        })));
        const schemaStatus = this.db.getSchemaStatus();
        if (schemaStatus.pendingVersions.length > 0) {
            findings.push({
                code: "schema_outdated",
                severity: "p0",
                message: `Missing required migrations: ${schemaStatus.pendingVersions.join(", ")}`,
                entityType: "database",
                entityId: "sqlite",
            });
        }
        if (schemaStatus.checksumMismatches.length > 0) {
            findings.push({
                code: "migration_checksum_mismatch",
                severity: "p0",
                message: `Migration checksum mismatch for versions: ${schemaStatus.checksumMismatches
                    .map((item) => item.version)
                    .join(", ")}`,
                entityType: "database",
                entityId: "sqlite",
            });
        }
        findings.push(...this.store.operations.listActiveTasksWithoutWorkflow().map((record) => ({
            code: "active_task_missing_workflow",
            severity: "p0",
            message: `Task ${record.taskId} is ${record.taskStatus} without workflow_state`,
            entityType: "task",
            entityId: record.taskId,
        })));
        findings.push(...buildInvalidStepIndexFindings(this.store.workflow.listWorkflowStates()));
        findings.push(...this.store.operations.listStaleExecutions(minusMs(checkedAt, staleExecutionAfterMs)).map((record) => ({
            code: "stale_execution",
            severity: "p1",
            message: `Execution ${record.executionId} has no progress since ${record.updatedAt}`,
            entityType: "execution",
            entityId: record.executionId,
        })));
        findings.push(...this.dispatchReconciliation.scan(checkedAt).map((issue) => ({
            code: issue.issueType,
            severity: "p1",
            message: issue.issueType === "orphan_queue_claim"
                ? `Dispatch ticket ${issue.ticketId} is claimed without a valid active lease (${issue.reasonCode})`
                : `Dispatch ticket ${issue.ticketId} points at terminal execution ${issue.executionId} (${issue.executionStatus})`,
            entityType: "ticket",
            entityId: issue.ticketId,
        })));
        findings.push(...this.store.operations.listWorkflowTerminalMismatches().map((record) => ({
            code: "workflow_terminal_state_mismatch",
            severity: "p1",
            message: buildWorkflowTerminalMismatchMessage(record),
            entityType: "workflow",
            entityId: record.taskId,
        })));
        findings.push(...this.store.operations.listOrphanSessions().map((record) => ({
            code: "orphan_session",
            severity: "p1",
            message: `Session ${record.sessionId} is ${record.sessionStatus} while task ${record.taskId} is ${record.taskStatus}`,
            entityType: "session",
            entityId: record.sessionId,
        })));
        findings.push(...this.store.operations.listActiveTasksWithTerminalSessions().map((record) => ({
            code: "active_task_terminal_session",
            severity: "p1",
            message: `Task ${record.taskId} is ${record.taskStatus} but latest session ${record.sessionId} is already ${record.sessionStatus}`,
            entityType: "session",
            entityId: record.sessionId,
        })));
        findings.push(...this.store.lock.listExpiredFileLocks(checkedAt).map(buildExpiredFileLockFinding));
        findings.push(...this.store.event.listPendingTier1Acks(minusMs(checkedAt, pendingAckOlderThanMs)).map((record) => ({
            code: "tier1_ack_backlog",
            severity: "p1",
            message: `Tier 1 event ${record.eventId} for consumer ${record.consumerId} is still pending`,
            entityType: "event",
            entityId: record.eventId,
        })));
        findings.push(...this.store.operations.listActiveExecutionConflicts().map((record) => ({
            code: "active_execution_conflict",
            severity: "p0",
            message: `Task ${record.taskId} has multiple active executions: ${record.activeExecutionIds.join(", ")}`,
            entityType: "task",
            entityId: record.taskId,
        })));
        for (const record of this.store.event.listTier1EventRegistryCoverage()) {
            if (!hasEventSchema(record.eventType)) {
                findings.push({
                    code: "event_schema_missing",
                    severity: "p0",
                    message: `Tier 1 event ${record.eventId} uses unregistered type ${record.eventType}`,
                    entityType: "event",
                    entityId: record.eventId,
                });
                continue;
            }
            const expectedConsumers = [...getRegisteredConsumers(record.eventType)].sort();
            const missingConsumers = expectedConsumers.filter((consumerId) => !record.ackConsumers.includes(consumerId));
            if (missingConsumers.length > 0) {
                findings.push({
                    code: "event_consumer_mismatch",
                    severity: "p1",
                    message: `Tier 1 event ${record.eventId} is missing ack records for consumers: ${missingConsumers.join(", ")}`,
                    entityType: "event",
                    entityId: record.eventId,
                });
            }
        }
        const repairActions = uniqueRepairActions(findings.map((finding) => {
            switch (finding.code) {
                case "config_load_failed":
                case "config_invalid":
                case "provider_not_ready":
                case "stale_execution":
                    return {
                        action: finding.code === "stale_execution" ? "requeue_execution" : "manual_intervention_required",
                        reasonCode: finding.code,
                        targetType: finding.entityType,
                        targetId: finding.entityId,
                    };
                case "orphan_queue_claim":
                case "terminal_execution_ticket":
                    return {
                        action: "reconcile_dispatch_ticket",
                        reasonCode: finding.code,
                        targetType: finding.entityType,
                        targetId: finding.entityId,
                    };
                case "orphan_session":
                    return {
                        action: "close_orphan_session",
                        reasonCode: finding.code,
                        targetType: finding.entityType,
                        targetId: finding.entityId,
                    };
                case "active_task_terminal_session":
                    return {
                        action: "replace_terminal_session",
                        reasonCode: finding.code,
                        targetType: finding.entityType,
                        targetId: finding.entityId,
                    };
                case "workflow_terminal_state_mismatch":
                    return {
                        action: "reconcile_terminal_state",
                        reasonCode: finding.code,
                        targetType: finding.entityType,
                        targetId: finding.entityId,
                    };
                case "expired_file_lock":
                    return {
                        action: "release_stale_lock",
                        reasonCode: finding.code,
                        targetType: finding.entityType,
                        targetId: finding.entityId,
                    };
                case "tier1_ack_backlog":
                case "event_consumer_mismatch":
                    return {
                        action: "rebuild_ack",
                        reasonCode: finding.code,
                        targetType: finding.entityType,
                        targetId: finding.entityId,
                    };
                default:
                    return {
                        action: "manual_intervention_required",
                        reasonCode: finding.code,
                        targetType: finding.entityType,
                        targetId: finding.entityId,
                    };
            }
        }));
        const status = findings.some((finding) => finding.severity === "p0")
            ? "fail_closed"
            : findings.length > 0
                ? "repairable"
                : "pass";
        return {
            checkedAt,
            status,
            findings,
            repairActions,
        };
    }
}
function buildWorkflowTerminalMismatchMessage(record) {
    const expectedTaskStatus = workflowStatusToTaskStatus(record.workflowStatus);
    const expectedSessionStatus = workflowStatusToSessionStatus(record.workflowStatus);
    const mismatches = [`task=${record.taskStatus} expected=${expectedTaskStatus}`];
    if (record.sessionStatus != null && record.sessionStatus !== expectedSessionStatus) {
        mismatches.push(`session=${record.sessionStatus} expected=${expectedSessionStatus}`);
    }
    return `Workflow for task ${record.taskId} is ${record.workflowStatus} but ${mismatches.join(", ")}`;
}
function workflowStatusToTaskStatus(workflowStatus) {
    return workflowStatus === "completed" ? "done" : workflowStatus;
}
function workflowStatusToSessionStatus(workflowStatus) {
    return workflowStatus === "completed" ? "completed" : workflowStatus;
}
//# sourceMappingURL=startup-consistency-checker.js.map