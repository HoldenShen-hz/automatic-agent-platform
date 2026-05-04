/**
 * AsyncOperationsRepository - Async data access for analytics, archives, replay, and data movement.
 *
 * This is the async PostgreSQL-compatible version of OperationsRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */

import type {
  AnalyticsFactRecord,
  ArchiveBundleRecord,
  DataMovementJobRecord,
  ReplayDatasetRecord,
} from "../../../contracts/types/domain.js";
import type { ExecutionAuthoritativeView } from "../sqlite/authoritative-task-store-types.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";
import { buildTenantClause } from "../async-query-helper.js";
import { nowIso } from "../../../contracts/types/ids.js";

export class AsyncOperationsRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  public async loadExecutionAuthoritativeView(
    executionId: string,
    tenantId?: string | null,
  ): Promise<ExecutionAuthoritativeView | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    const tenantClause = scopedTenantId !== undefined ? " AND t.tenant_id = $2" : "";
    const execution = await asyncQueryOne<ExecutionAuthoritativeView["execution"]>(
      this.conn,
      `SELECT
         e.id,
         e.task_id AS "taskId",
         e.workflow_id AS "workflowId",
         e.parent_execution_id AS "parentExecutionId",
         e.agent_id AS "agentId",
         e.role_id AS "roleId",
         e.run_kind AS "runKind",
         e.status,
         e.input_ref AS "inputRef",
         e.trace_id AS "traceId",
         e.attempt,
         e.timeout_ms AS "timeoutMs",
         e.budget_usd_limit AS "budgetUsdLimit",
         e.requires_approval AS "requiresApproval",
         e.sandbox_mode AS "sandboxMode",
         e.allowed_tools_json AS "allowedToolsJson",
         e.allowed_paths_json AS "allowedPathsJson",
         e.max_retries AS "maxRetries",
         e.retry_backoff AS "retryBackoff",
         e.last_error_code AS "lastErrorCode",
         e.last_error_message AS "lastErrorMessage",
         e.started_at AS "startedAt",
         e.finished_at AS "finishedAt",
         e.created_at AS "createdAt",
         e.updated_at AS "updatedAt"
       FROM executions e
       INNER JOIN tasks t ON t.id = e.task_id
       WHERE e.id = $1${tenantClause}`,
      ...(scopedTenantId !== undefined ? [executionId, scopedTenantId] : [executionId]),
    );
    if (execution == null) {
      return null;
    }

    const [task, workflow, session] = await Promise.all([
      asyncQueryOne<ExecutionAuthoritativeView["task"]>(
        this.conn,
        `SELECT
           t.id,
           t.parent_id AS "parentId",
           t.root_id AS "rootId",
           t.division_id AS "divisionId",
           t.tenant_id AS "tenantId",
           t.title,
           t.status,
           t.source,
           t.priority,
           t.input_json AS "inputJson",
           t.normalized_input_json AS "normalizedInputJson",
           t.output_json AS "outputJson",
           t.estimated_cost_usd AS "estimatedCostUsd",
           t.actual_cost_usd AS "actualCostUsd",
           t.error_code AS "errorCode",
           t.created_at AS "createdAt",
           t.updated_at AS "updatedAt",
           t.completed_at AS "completedAt"
         FROM tasks t
         WHERE t.id = $1${tenantClause}`,
        ...(scopedTenantId !== undefined ? [execution.taskId, scopedTenantId] : [execution.taskId]),
      ),
      asyncQueryOne<ExecutionAuthoritativeView["workflow"]>(
        this.conn,
        `SELECT
           w.task_id AS "taskId",
           w.division_id AS "divisionId",
           w.workflow_id AS "workflowId",
           w.current_step_index AS "currentStepIndex",
           w.status,
           w.outputs_json AS "outputsJson",
           w.last_error_code AS "lastErrorCode",
           w.retry_count AS "retryCount",
           w.resumable_from_step AS "resumableFromStep",
           w.started_at AS "startedAt",
           w.updated_at AS "updatedAt"
         FROM workflow_state w
         INNER JOIN tasks t ON t.id = w.task_id
         WHERE w.task_id = $1${tenantClause}`,
        ...(scopedTenantId !== undefined ? [execution.taskId, scopedTenantId] : [execution.taskId]),
      ),
      asyncQueryOne<ExecutionAuthoritativeView["session"]>(
        this.conn,
        `SELECT
           s.id,
           s.task_id AS "taskId",
           s.channel,
           s.status,
           s.external_session_id AS "externalSessionId",
           s.created_at AS "createdAt",
           s.updated_at AS "updatedAt"
         FROM sessions s
         INNER JOIN tasks t ON t.id = s.task_id
         WHERE s.task_id = $1${tenantClause}
         ORDER BY s.created_at DESC, s.updated_at DESC, s.id DESC
         LIMIT 1`,
        ...(scopedTenantId !== undefined ? [execution.taskId, scopedTenantId] : [execution.taskId]),
      ),
    ]);

    return {
      execution,
      task: task ?? null,
      workflow: workflow ?? null,
      session: session ?? null,
      consistency: "authoritative",
      observedAt: nowIso(),
    };
  }

  public async insertAnalyticsFactRecord(record: AnalyticsFactRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO analytics_facts (
        fact_id, namespace_id, tenant_id, organization_id, workspace_id, metric_name,
        dimension_json, value, window_start, window_end, source_ref, captured_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      record.factId,
      record.namespaceId,
      record.tenantId,
      record.organizationId,
      record.workspaceId,
      record.metricName,
      record.dimensionJson,
      record.value,
      record.windowStart,
      record.windowEnd,
      record.sourceRef,
      record.capturedAt,
    );
  }

  public async listAnalyticsFactRecords(options: {
    namespaceId?: string;
    tenantId?: string | null;
    metricName?: string;
    limit?: number;
  } = {}): Promise<AnalyticsFactRecord[]> {
    const conditions: string[] = [];
    const parameters: unknown[] = [];

    if (options.namespaceId != null) {
      conditions.push(`namespace_id = $${parameters.length + 1}`);
      parameters.push(options.namespaceId);
    }
    if (options.tenantId !== undefined) {
      const { clause, args } = buildTenantClause(options.tenantId);
      if (clause) {
        conditions.push(clause);
        parameters.push(...args);
      }
    }
    if (options.metricName != null) {
      conditions.push(`metric_name = $${parameters.length + 1}`);
      parameters.push(options.metricName);
    }

    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
    parameters.push(safeLimit);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return asyncQueryAll<AnalyticsFactRecord>(
      this.conn,
      `SELECT
         fact_id AS "factId",
         namespace_id AS "namespaceId",
         tenant_id AS "tenantId",
         organization_id AS "organizationId",
         workspace_id AS "workspaceId",
         metric_name AS "metricName",
         dimension_json AS "dimensionJson",
         value,
         window_start AS "windowStart",
         window_end AS "windowEnd",
         source_ref AS "sourceRef",
         captured_at AS "capturedAt"
       FROM analytics_facts
       ${whereClause}
       ORDER BY captured_at DESC, fact_id ASC
       LIMIT $${parameters.length}`,
      ...parameters,
    );
  }

  public async insertArchiveBundleRecord(record: ArchiveBundleRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO archive_bundles (
        bundle_id, namespace_id, tenant_id, organization_id, workspace_id, bundle_type,
        source_refs_json, summary_ref, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      record.bundleId,
      record.namespaceId,
      record.tenantId,
      record.organizationId,
      record.workspaceId,
      record.bundleType,
      record.sourceRefsJson,
      record.summaryRef,
      record.createdAt,
    );
  }

  public async listArchiveBundleRecords(options: {
    namespaceId?: string;
    tenantId?: string | null;
    bundleType?: string;
    limit?: number;
  } = {}): Promise<ArchiveBundleRecord[]> {
    const conditions: string[] = [];
    const parameters: unknown[] = [];

    if (options.namespaceId != null) {
      conditions.push(`namespace_id = $${parameters.length + 1}`);
      parameters.push(options.namespaceId);
    }
    if (options.tenantId !== undefined) {
      const { clause, args } = buildTenantClause(options.tenantId);
      if (clause) {
        conditions.push(clause);
        parameters.push(...args);
      }
    }
    if (options.bundleType != null) {
      conditions.push(`bundle_type = $${parameters.length + 1}`);
      parameters.push(options.bundleType);
    }

    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
    parameters.push(safeLimit);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return asyncQueryAll<ArchiveBundleRecord>(
      this.conn,
      `SELECT
         bundle_id AS "bundleId",
         namespace_id AS "namespaceId",
         tenant_id AS "tenantId",
         organization_id AS "organizationId",
         workspace_id AS "workspaceId",
         bundle_type AS "bundleType",
         source_refs_json AS "sourceRefsJson",
         summary_ref AS "summaryRef",
         created_at AS "createdAt"
       FROM archive_bundles
       ${whereClause}
       ORDER BY created_at DESC, bundle_id ASC
       LIMIT $${parameters.length}`,
      ...parameters,
    );
  }

  public async insertReplayDatasetRecord(record: ReplayDatasetRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO replay_datasets (
        dataset_id, namespace_id, tenant_id, organization_id, workspace_id, dataset_type,
        sample_refs_json, truth_refs_json, version, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      record.datasetId,
      record.namespaceId,
      record.tenantId,
      record.organizationId,
      record.workspaceId,
      record.datasetType,
      record.sampleRefsJson,
      record.truthRefsJson,
      record.version,
      record.createdAt,
    );
  }

  public async listReplayDatasetRecords(options: {
    namespaceId?: string;
    tenantId?: string | null;
    datasetType?: string;
    limit?: number;
  } = {}): Promise<ReplayDatasetRecord[]> {
    const conditions: string[] = [];
    const parameters: unknown[] = [];

    if (options.namespaceId != null) {
      conditions.push(`namespace_id = $${parameters.length + 1}`);
      parameters.push(options.namespaceId);
    }
    if (options.tenantId !== undefined) {
      const { clause, args } = buildTenantClause(options.tenantId);
      if (clause) {
        conditions.push(clause);
        parameters.push(...args);
      }
    }
    if (options.datasetType != null) {
      conditions.push(`dataset_type = $${parameters.length + 1}`);
      parameters.push(options.datasetType);
    }

    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
    parameters.push(safeLimit);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return asyncQueryAll<ReplayDatasetRecord>(
      this.conn,
      `SELECT
         dataset_id AS "datasetId",
         namespace_id AS "namespaceId",
         tenant_id AS "tenantId",
         organization_id AS "organizationId",
         workspace_id AS "workspaceId",
         dataset_type AS "datasetType",
         sample_refs_json AS "sampleRefsJson",
         truth_refs_json AS "truthRefsJson",
         version,
         created_at AS "createdAt"
       FROM replay_datasets
       ${whereClause}
       ORDER BY created_at DESC, dataset_id ASC
       LIMIT $${parameters.length}`,
      ...parameters,
    );
  }

  public async upsertDataMovementJobRecord(record: DataMovementJobRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO data_movement_jobs (
        job_id, tenant_id, organization_id, workspace_id, source_namespace_id, target_namespace_id,
        source_plane, target_plane, movement_type, input_refs_json, status, started_at, finished_at, report_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        report_json = excluded.report_json`,
      record.jobId,
      record.tenantId,
      record.organizationId,
      record.workspaceId,
      record.sourceNamespaceId,
      record.targetNamespaceId,
      record.sourcePlane,
      record.targetPlane,
      record.movementType,
      record.inputRefsJson,
      record.status,
      record.startedAt,
      record.finishedAt,
      record.reportJson,
    );
  }

  public async getDataMovementJobRecord(jobId: string): Promise<DataMovementJobRecord | null> {
    const result = await asyncQueryOne<DataMovementJobRecord>(
      this.conn,
      `SELECT
         job_id AS "jobId",
         tenant_id AS "tenantId",
         organization_id AS "organizationId",
         workspace_id AS "workspaceId",
         source_namespace_id AS "sourceNamespaceId",
         target_namespace_id AS "targetNamespaceId",
         source_plane AS "sourcePlane",
         target_plane AS "targetPlane",
         movement_type AS "movementType",
         input_refs_json AS "inputRefsJson",
         status,
         started_at AS "startedAt",
         finished_at AS "finishedAt",
         report_json AS "reportJson"
       FROM data_movement_jobs
       WHERE job_id = $1`,
      jobId,
    );
    return result ?? null;
  }

  public async listDataMovementJobRecords(options: {
    tenantId?: string | null;
    status?: DataMovementJobRecord["status"];
    movementType?: DataMovementJobRecord["movementType"];
    limit?: number;
  } = {}): Promise<DataMovementJobRecord[]> {
    const conditions: string[] = [];
    const parameters: unknown[] = [];
    const scopedTenantId = resolveTenantScope(options.tenantId);

    if (scopedTenantId !== undefined) {
      conditions.push(`tenant_id = $${parameters.length + 1}`);
      parameters.push(scopedTenantId);
    }
    if (options.status != null) {
      conditions.push(`status = $${parameters.length + 1}`);
      parameters.push(options.status);
    }
    if (options.movementType != null) {
      conditions.push(`movement_type = $${parameters.length + 1}`);
      parameters.push(options.movementType);
    }

    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
    parameters.push(safeLimit);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return asyncQueryAll<DataMovementJobRecord>(
      this.conn,
      `SELECT
         job_id AS "jobId",
         tenant_id AS "tenantId",
         organization_id AS "organizationId",
         workspace_id AS "workspaceId",
         source_namespace_id AS "sourceNamespaceId",
         target_namespace_id AS "targetNamespaceId",
         source_plane AS "sourcePlane",
         target_plane AS "targetPlane",
         movement_type AS "movementType",
         input_refs_json AS "inputRefsJson",
         status,
         started_at AS "startedAt",
         finished_at AS "finishedAt",
         report_json AS "reportJson"
       FROM data_movement_jobs
       ${whereClause}
       ORDER BY started_at DESC, job_id ASC
       LIMIT $${parameters.length}`,
      ...parameters,
    );
  }
}
