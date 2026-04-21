import { nowIso } from "../../../../contracts/types/ids.js";
import { StorageError } from "../../../../contracts/errors.js";
import { mapRuntimeRecoveryRecord, resolveTenantScope, } from "../authoritative-task-store-types.js";
import { execute, queryAll, queryOne } from "../query-helper.js";
import { ArtifactRepository } from "./artifact-repository.js";
import { DispatchRepository } from "./dispatch-repository.js";
import { DivisionRepository } from "./division-repository.js";
import { EvolutionRepository } from "./evolution-repository.js";
import { TaskRepository } from "./task-repository.js";
import { WorkflowRepository } from "./workflow-repository.js";
/**
 * Standalone repository boundary for analytics / archive / replay / data-movement
 * records plus runtime consistency and recovery read models.
 */
export class OperationsRepository {
    db;
    taskRepository;
    workflowRepository;
    dispatchRepository;
    artifactRepository;
    divisionRepository;
    evolutionRepository;
    constructor(db) {
        this.db = db;
        const conn = db.connection;
        this.taskRepository = new TaskRepository(conn);
        this.workflowRepository = new WorkflowRepository(conn);
        this.dispatchRepository = new DispatchRepository(conn);
        this.artifactRepository = new ArtifactRepository(conn);
        this.divisionRepository = new DivisionRepository(conn);
        this.evolutionRepository = new EvolutionRepository(db);
    }
    insertAnalyticsFactRecord(record) {
        execute(this.db.connection, `INSERT INTO analytics_facts (
        fact_id, namespace_id, tenant_id, organization_id, workspace_id, metric_name,
        dimension_json, value, window_start, window_end, source_ref, captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, record.factId, record.namespaceId, record.tenantId, record.organizationId, record.workspaceId, record.metricName, record.dimensionJson, record.value, record.windowStart, record.windowEnd, record.sourceRef, record.capturedAt);
    }
    listAnalyticsFactRecords(options = {}) {
        const conditions = [];
        const parameters = [];
        if (options.namespaceId != null) {
            conditions.push("namespace_id = ?");
            parameters.push(options.namespaceId);
        }
        if (options.tenantId !== undefined) {
            conditions.push("tenant_id IS ?");
            parameters.push(options.tenantId);
        }
        if (options.metricName != null) {
            conditions.push("metric_name = ?");
            parameters.push(options.metricName);
        }
        const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
        parameters.push(safeLimit);
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        return queryAll(this.db.connection, `SELECT
         fact_id AS factId,
         namespace_id AS namespaceId,
         tenant_id AS tenantId,
         organization_id AS organizationId,
         workspace_id AS workspaceId,
         metric_name AS metricName,
         dimension_json AS dimensionJson,
         value,
         window_start AS windowStart,
         window_end AS windowEnd,
         source_ref AS sourceRef,
         captured_at AS capturedAt
       FROM analytics_facts
       ${whereClause}
       ORDER BY captured_at DESC, fact_id ASC
       LIMIT ?`, ...parameters);
    }
    insertArchiveBundleRecord(record) {
        execute(this.db.connection, `INSERT INTO archive_bundles (
        bundle_id, namespace_id, tenant_id, organization_id, workspace_id, bundle_type,
        source_refs_json, summary_ref, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, record.bundleId, record.namespaceId, record.tenantId, record.organizationId, record.workspaceId, record.bundleType, record.sourceRefsJson, record.summaryRef, record.createdAt);
    }
    listArchiveBundleRecords(options = {}) {
        const conditions = [];
        const parameters = [];
        if (options.namespaceId != null) {
            conditions.push("namespace_id = ?");
            parameters.push(options.namespaceId);
        }
        if (options.tenantId !== undefined) {
            conditions.push("tenant_id IS ?");
            parameters.push(options.tenantId);
        }
        if (options.bundleType != null) {
            conditions.push("bundle_type = ?");
            parameters.push(options.bundleType);
        }
        const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
        parameters.push(safeLimit);
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        return queryAll(this.db.connection, `SELECT
         bundle_id AS bundleId,
         namespace_id AS namespaceId,
         tenant_id AS tenantId,
         organization_id AS organizationId,
         workspace_id AS workspaceId,
         bundle_type AS bundleType,
         source_refs_json AS sourceRefsJson,
         summary_ref AS summaryRef,
         created_at AS createdAt
       FROM archive_bundles
       ${whereClause}
       ORDER BY created_at DESC, bundle_id ASC
       LIMIT ?`, ...parameters);
    }
    insertReplayDatasetRecord(record) {
        execute(this.db.connection, `INSERT INTO replay_datasets (
        dataset_id, namespace_id, tenant_id, organization_id, workspace_id, dataset_type,
        sample_refs_json, truth_refs_json, version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, record.datasetId, record.namespaceId, record.tenantId, record.organizationId, record.workspaceId, record.datasetType, record.sampleRefsJson, record.truthRefsJson, record.version, record.createdAt);
    }
    listReplayDatasetRecords(options = {}) {
        const conditions = [];
        const parameters = [];
        if (options.namespaceId != null) {
            conditions.push("namespace_id = ?");
            parameters.push(options.namespaceId);
        }
        if (options.tenantId !== undefined) {
            conditions.push("tenant_id IS ?");
            parameters.push(options.tenantId);
        }
        if (options.datasetType != null) {
            conditions.push("dataset_type = ?");
            parameters.push(options.datasetType);
        }
        const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
        parameters.push(safeLimit);
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        return queryAll(this.db.connection, `SELECT
         dataset_id AS datasetId,
         namespace_id AS namespaceId,
         tenant_id AS tenantId,
         organization_id AS organizationId,
         workspace_id AS workspaceId,
         dataset_type AS datasetType,
         sample_refs_json AS sampleRefsJson,
         truth_refs_json AS truthRefsJson,
         version,
         created_at AS createdAt
       FROM replay_datasets
       ${whereClause}
       ORDER BY created_at DESC, dataset_id ASC
       LIMIT ?`, ...parameters);
    }
    upsertDataMovementJobRecord(record) {
        execute(this.db.connection, `INSERT INTO data_movement_jobs (
        job_id, tenant_id, organization_id, workspace_id, source_namespace_id, target_namespace_id,
        source_plane, target_plane, movement_type, input_refs_json, status, started_at, finished_at, report_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        organization_id = excluded.organization_id,
        workspace_id = excluded.workspace_id,
        source_namespace_id = excluded.source_namespace_id,
        target_namespace_id = excluded.target_namespace_id,
        source_plane = excluded.source_plane,
        target_plane = excluded.target_plane,
        movement_type = excluded.movement_type,
        input_refs_json = excluded.input_refs_json,
        status = excluded.status,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        report_json = excluded.report_json`, record.jobId, record.tenantId, record.organizationId, record.workspaceId, record.sourceNamespaceId, record.targetNamespaceId, record.sourcePlane, record.targetPlane, record.movementType, record.inputRefsJson, record.status, record.startedAt, record.finishedAt, record.reportJson);
    }
    getDataMovementJobRecord(jobId) {
        return queryOne(this.db.connection, `SELECT
         job_id AS jobId,
         tenant_id AS tenantId,
         organization_id AS organizationId,
         workspace_id AS workspaceId,
         source_namespace_id AS sourceNamespaceId,
         target_namespace_id AS targetNamespaceId,
         source_plane AS sourcePlane,
         target_plane AS targetPlane,
         movement_type AS movementType,
         input_refs_json AS inputRefsJson,
         status,
         started_at AS startedAt,
         finished_at AS finishedAt,
         report_json AS reportJson
       FROM data_movement_jobs
       WHERE job_id = ?`, jobId) ?? null;
    }
    listDataMovementJobRecords(options = {}) {
        return this.divisionRepository.listDataMovementJobRecords(options);
    }
    insertPmfValidationReport(...args) {
        this.evolutionRepository.insertPmfValidationReport(...args);
    }
    listPmfValidationReports(...args) {
        return this.evolutionRepository.listPmfValidationReports(...args);
    }
    getLatestPmfValidationReport(...args) {
        return this.evolutionRepository.getLatestPmfValidationReport(...args);
    }
    listTaskBoardItems(limit = 25, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        const baseSql = `SELECT
          t.id AS task_id,
          t.title AS title,
          t.priority AS priority,
          t.status AS task_status,
          t.division_id AS division_id,
          t.updated_at AS updated_at,
          w.status AS workflow_status,
          w.current_step_index AS current_step_index,
          s.status AS session_status,
          (
            SELECT MAX(e.created_at)
            FROM events e
            WHERE e.task_id = t.id
          ) AS latest_event_at
         FROM tasks t
         LEFT JOIN workflow_state w ON w.task_id = t.id
         LEFT JOIN sessions s ON s.task_id = t.id
         ${scopedTenantId !== undefined ? "WHERE t.tenant_id = ?" : ""}
         ORDER BY t.updated_at DESC
         LIMIT ?`;
        return this.db.connection
            .prepare(baseSql)
            .all(...(scopedTenantId !== undefined ? [scopedTenantId, limit] : [limit]))
            .map((row) => {
            const record = row;
            return {
                taskId: String(record.task_id),
                title: String(record.title),
                priority: record.priority,
                taskStatus: record.task_status,
                workflowStatus: record.workflow_status ?? null,
                divisionId: record.division_id ?? null,
                currentStepIndex: record.current_step_index == null ? null : Number(record.current_step_index),
                sessionStatus: record.session_status ?? null,
                latestEventAt: record.latest_event_at ?? null,
                updatedAt: String(record.updated_at),
            };
        });
    }
    listActiveTasksWithoutWorkflow(tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        return this.db.connection
            .prepare(`SELECT
          t.id AS task_id,
          t.status AS task_status
         FROM tasks t
         LEFT JOIN workflow_state w ON w.task_id = t.id
         WHERE t.status IN ('in_progress', 'awaiting_decision')
           AND w.task_id IS NULL
           ${scopedTenantId !== undefined ? "AND t.tenant_id = ?" : ""}`)
            .all(...(scopedTenantId !== undefined ? [scopedTenantId] : []))
            .map((row) => {
            const record = row;
            return {
                taskId: String(record.task_id),
                taskStatus: record.task_status,
            };
        });
    }
    listStaleExecutions(updatedBefore, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        return this.db.connection
            .prepare(`SELECT
          e.id AS execution_id,
          e.task_id AS task_id,
          e.status AS status,
          e.updated_at AS updated_at
         FROM executions e
         JOIN tasks t ON t.id = e.task_id
         WHERE e.status IN ('prechecking', 'executing', 'blocked')
           AND e.updated_at < ?
           ${scopedTenantId !== undefined ? "AND t.tenant_id = ?" : ""}`)
            .all(...(scopedTenantId !== undefined ? [updatedBefore, scopedTenantId] : [updatedBefore]))
            .map((row) => {
            const record = row;
            return {
                executionId: String(record.execution_id),
                taskId: String(record.task_id),
                status: record.status,
                updatedAt: String(record.updated_at),
            };
        });
    }
    listRecoverableExecutingRuns(now, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return this.listRuntimeRecoveryRecords(`e.status IN ('created', 'prechecking', 'executing', 'blocked')
         AND e.created_at <= ?
         AND t.tenant_id = ?`, [now, scopedTenantId]);
        }
        return this.listRuntimeRecoveryRecords(`e.status IN ('created', 'prechecking', 'executing', 'blocked')
       AND e.created_at <= ?`, [now]);
    }
    listBlockedRunsAwaitingApproval(tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return this.listRuntimeRecoveryRecords(`e.status = 'blocked'
         AND t.tenant_id = ?
         AND EXISTS (
           SELECT 1
           FROM approvals a
           WHERE a.execution_id = e.id
             AND a.status = 'requested'
         )`, [scopedTenantId]);
        }
        return this.listRuntimeRecoveryRecords(`e.status = 'blocked'
       AND EXISTS (
         SELECT 1
         FROM approvals a
         WHERE a.execution_id = e.id
           AND a.status = 'requested'
       )`);
    }
    listStaleRuns(staleBefore, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return this.listRuntimeRecoveryRecords(`e.status IN ('created', 'prechecking', 'executing', 'blocked')
         AND t.tenant_id = ?
         AND COALESCE(
           (
             SELECT MAX(h.sampled_at)
             FROM heartbeat_snapshots h
             WHERE h.execution_id = e.id
           ),
           e.updated_at
         ) < ?`, [scopedTenantId, staleBefore]);
        }
        return this.listRuntimeRecoveryRecords(`e.status IN ('created', 'prechecking', 'executing', 'blocked')
       AND COALESCE(
         (
           SELECT MAX(h.sampled_at)
           FROM heartbeat_snapshots h
           WHERE h.execution_id = e.id
         ),
         e.updated_at
       ) < ?`, [staleBefore]);
    }
    buildRuntimeRecoveryView(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return this.listRuntimeRecoveryRecords("e.task_id = ? AND t.tenant_id = ?", [taskId, scopedTenantId]);
        }
        return this.listRuntimeRecoveryRecords("e.task_id = ?", [taskId]);
    }
    listOrphanSessions(tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        return this.db.connection
            .prepare(`SELECT
          s.id AS session_id,
          s.task_id AS task_id,
          s.status AS session_status,
          t.status AS task_status
         FROM sessions s
         JOIN tasks t ON t.id = s.task_id
         WHERE s.status IN ('open', 'streaming', 'awaiting_user', 'paused')
           AND t.status IN ('done', 'failed', 'cancelled')
           ${scopedTenantId !== undefined ? "AND t.tenant_id = ?" : ""}`)
            .all(...(scopedTenantId !== undefined ? [scopedTenantId] : []))
            .map((row) => {
            const record = row;
            return {
                sessionId: String(record.session_id),
                taskId: String(record.task_id),
                sessionStatus: record.session_status,
                taskStatus: record.task_status,
            };
        });
    }
    listWorkflowTerminalMismatches(tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        return this.db.connection
            .prepare(`SELECT
          w.task_id AS task_id,
          w.status AS workflow_status,
          w.updated_at AS workflow_updated_at,
          t.status AS task_status,
          s.id AS session_id,
          s.status AS session_status
         FROM workflow_state w
         JOIN tasks t ON t.id = w.task_id
         LEFT JOIN sessions s ON s.id = (
           SELECT s2.id
           FROM sessions s2
           WHERE s2.task_id = w.task_id
           ORDER BY s2.created_at DESC, s2.id DESC
           LIMIT 1
         )
         WHERE w.status IN ('completed', 'failed', 'cancelled')
           ${scopedTenantId !== undefined ? "AND t.tenant_id = ?" : ""}
           AND (
             (w.status = 'completed' AND t.status != 'done')
             OR (w.status = 'failed' AND t.status != 'failed')
             OR (w.status = 'cancelled' AND t.status != 'cancelled')
             OR (
               s.id IS NOT NULL
               AND (
                 (w.status = 'completed' AND s.status != 'completed')
                 OR (w.status = 'failed' AND s.status != 'failed')
                 OR (w.status = 'cancelled' AND s.status != 'cancelled')
               )
             )
           )`)
            .all(...(scopedTenantId !== undefined ? [scopedTenantId] : []))
            .map((row) => {
            const record = row;
            return {
                taskId: String(record.task_id),
                workflowStatus: record.workflow_status,
                workflowUpdatedAt: String(record.workflow_updated_at),
                taskStatus: record.task_status,
                sessionId: record.session_id ?? null,
                sessionStatus: record.session_status ?? null,
            };
        });
    }
    listActiveTasksWithTerminalSessions(tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        return this.db.connection
            .prepare(`SELECT
          t.id AS task_id,
          t.status AS task_status,
          s.id AS session_id,
          s.status AS session_status
         FROM tasks t
         JOIN sessions s ON s.id = (
           SELECT s2.id
           FROM sessions s2
           WHERE s2.task_id = t.id
           ORDER BY s2.created_at DESC, s2.id DESC
           LIMIT 1
         )
         WHERE t.status IN ('queued', 'pending', 'in_progress', 'awaiting_decision')
           AND s.status IN ('completed', 'failed', 'cancelled')
           ${scopedTenantId !== undefined ? "AND t.tenant_id = ?" : ""}`)
            .all(...(scopedTenantId !== undefined ? [scopedTenantId] : []))
            .map((row) => {
            const record = row;
            return {
                taskId: String(record.task_id),
                taskStatus: record.task_status,
                sessionId: String(record.session_id),
                sessionStatus: record.session_status,
            };
        });
    }
    listActiveExecutionActivity() {
        return this.db.connection
            .prepare(`SELECT
          e.id AS execution_id,
          e.task_id AS task_id,
          e.agent_id AS agent_id,
          e.status AS status,
          e.updated_at AS updated_at,
          (
            SELECT MAX(ev.created_at)
            FROM events ev
            WHERE ev.execution_id = e.id
          ) AS latest_event_at,
          (
            SELECT MAX(h.sampled_at)
            FROM heartbeat_snapshots h
            WHERE h.execution_id = e.id
          ) AS latest_heartbeat_at
         FROM executions e
         WHERE e.status IN ('created', 'prechecking', 'executing', 'blocked')`)
            .all()
            .map((row) => {
            const record = row;
            return {
                executionId: String(record.execution_id),
                taskId: String(record.task_id),
                agentId: String(record.agent_id),
                status: record.status,
                updatedAt: String(record.updated_at),
                latestEventAt: record.latest_event_at ?? null,
                latestHeartbeatAt: record.latest_heartbeat_at ?? null,
            };
        });
    }
    listActiveExecutionConflicts() {
        return this.db.connection
            .prepare(`SELECT
          task_id AS task_id,
          group_concat(id, ',') AS execution_ids
         FROM executions
         WHERE status IN ('created', 'prechecking', 'executing', 'blocked')
         GROUP BY task_id
         HAVING COUNT(*) > 1`)
            .all()
            .map((row) => {
            const record = row;
            return {
                taskId: String(record.task_id),
                activeExecutionIds: String(record.execution_ids).split(",").filter(Boolean),
            };
        });
    }
    loadTaskSnapshot(taskId, tenantId) {
        return this.db.readTransaction(() => {
            const observedAt = nowIso();
            const scopedTenantId = resolveTenantScope(tenantId);
            const task = this.taskRepository.getTask(taskId, scopedTenantId);
            if (!task) {
                throw new StorageError("storage.task_not_found", `Task not found: ${taskId}`, {
                    details: { taskId },
                    taskId,
                });
            }
            const workflow = this.workflowRepository.getWorkflowState(taskId, scopedTenantId);
            const execution = queryOne(this.db.connection, `SELECT
          id,
          task_id AS taskId,
          workflow_id AS workflowId,
          parent_execution_id AS parentExecutionId,
          agent_id AS agentId,
          role_id AS roleId,
          run_kind AS runKind,
          status,
          input_ref AS inputRef,
          trace_id AS traceId,
          attempt,
          timeout_ms AS timeoutMs,
          budget_usd_limit AS budgetUsdLimit,
          requires_approval AS requiresApproval,
          sandbox_mode AS sandboxMode,
          allowed_tools_json AS allowedToolsJson,
          allowed_paths_json AS allowedPathsJson,
          max_retries AS maxRetries,
          retry_backoff AS retryBackoff,
          last_error_code AS lastErrorCode,
          last_error_message AS lastErrorMessage,
          started_at AS startedAt,
          finished_at AS finishedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
         FROM executions
         WHERE task_id = ?
         ORDER BY created_at DESC
         LIMIT 1`, taskId) ?? null;
            const session = this.dispatchRepository.selectLatestSessionByTask(taskId);
            const stepOutputs = queryAll(this.db.connection, `SELECT
          id,
          task_id AS taskId,
          step_id AS stepId,
          role_id AS roleId,
          status,
          data_json AS dataJson,
          summary,
          artifacts_json AS artifactsJson,
          token_cost AS tokenCost,
          duration_ms AS durationMs,
          validation_json AS validationJson,
          produced_at AS producedAt
         FROM workflow_step_outputs
         WHERE task_id = ?
         ORDER BY produced_at ASC`, taskId);
            const artifacts = this.artifactRepository.listArtifactsByTask(taskId, scopedTenantId);
            const events = queryAll(this.db.connection, `SELECT
          id,
          task_id AS taskId,
          NULL AS sessionId,
          execution_id AS executionId,
          event_type AS eventType,
          event_tier AS eventTier,
          payload_json AS payloadJson,
          trace_id AS traceId,
          created_at AS createdAt
         FROM events
         WHERE task_id = ?
         ORDER BY created_at ASC`, taskId);
            return {
                task,
                workflow,
                execution,
                session,
                stepOutputs,
                artifacts,
                events,
                consistency: "authoritative",
                observedAt,
            };
        });
    }
    loadExecutionAuthoritativeView(executionId, tenantId) {
        return this.db.readTransaction(() => {
            const execution = this.dispatchRepository.getExecution(executionId, tenantId);
            if (!execution) {
                return null;
            }
            return {
                execution,
                task: this.taskRepository.getTask(execution.taskId, tenantId) ?? null,
                workflow: this.workflowRepository.getWorkflowState(execution.taskId, tenantId),
                session: this.dispatchRepository.selectLatestSessionByTask(execution.taskId) ?? null,
                consistency: "authoritative",
                observedAt: nowIso(),
            };
        });
    }
    listRuntimeRecoveryRecords(whereClause, params = []) {
        if (/;|--|\/\*/.test(whereClause)) {
            throw new Error("listRuntimeRecoveryRecords: whereClause contains forbidden SQL tokens");
        }
        const placeholderCount = (whereClause.match(/\?/g) ?? []).length;
        if (placeholderCount !== params.length) {
            throw new Error(`listRuntimeRecoveryRecords: placeholder/param count mismatch (${placeholderCount} vs ${params.length})`);
        }
        return this.db.connection
            .prepare(`SELECT
          e.id AS executionId,
          e.task_id AS taskId,
          t.division_id AS divisionId,
          t.status AS taskStatus,
          e.status AS status,
          e.attempt AS attempt,
          e.trace_id AS traceId,
          e.workflow_id AS workflowId,
          e.last_error_code AS latestErrorCode,
          e.updated_at AS updatedAt,
          (
            SELECT MAX(h.sampled_at)
            FROM heartbeat_snapshots h
            WHERE h.execution_id = e.id
          ) AS lastHeartbeatAt,
          (
            SELECT a.id
            FROM approvals a
            WHERE a.execution_id = e.id
              AND a.status = 'requested'
            ORDER BY a.created_at DESC
            LIMIT 1
          ) AS pendingApprovalId,
          ep.id AS precheckId,
          ep.execution_id AS precheckExecutionId,
          ep.allowed AS precheckAllowed,
          ep.reason_code AS precheckReasonCode,
          ep.resolved_budget_usd AS precheckResolvedBudgetUsd,
          ep.resolved_timeout_ms AS precheckResolvedTimeoutMs,
          ep.resolved_sandbox_mode AS precheckResolvedSandboxMode,
          ep.resolved_tools_json AS precheckResolvedToolsJson,
          ep.resolved_paths_json AS precheckResolvedPathsJson,
          ep.checked_at AS precheckCheckedAt
         FROM executions e
         JOIN tasks t ON t.id = e.task_id
         LEFT JOIN execution_prechecks ep ON ep.execution_id = e.id
         WHERE ${whereClause}
         ORDER BY t.division_id ASC, e.updated_at ASC, e.created_at ASC`)
            .all(...params)
            .map((row) => mapRuntimeRecoveryRecord(row));
    }
}
//# sourceMappingURL=operations-repository.js.map