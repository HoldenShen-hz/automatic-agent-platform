import type {
  DeploymentExecutionReportRecord,
  EnterpriseCapabilityReportRecord,
  EnterpriseGovernanceReportRecord,
  EnvironmentPromotionHistoryRecord,
  EnvironmentReadinessRecord,
  IncidentHandoffRecord,
  ReleaseBundleRecord,
  ReleaseExecutionReportRecord,
} from "../sqlite-repository-contracts.js";
import type { AuthoritativeSqlDatabase } from "../sqlite-database.js";
import { execute, queryAll, queryOne } from "../query-helper.js";

interface CursorPageOptions {
  readonly limit?: number;
  readonly cursor?: string | null;
}

interface ReportCursorPageOptions extends CursorPageOptions {
  readonly tenantId?: string | null;
}

interface TimestampCursorState {
  readonly timestamp: string;
  readonly id: string;
}

function normalizeCursorPage(input: number | CursorPageOptions | undefined): CursorPageOptions {
  if (input == null) {
    return {};
  }
  if (typeof input === "number") {
    return { limit: input };
  }
  return input;
}

function normalizeReportCursorPage(input: number | ReportCursorPageOptions | undefined): ReportCursorPageOptions {
  if (input == null) {
    return {};
  }
  if (typeof input === "number") {
    return { limit: input };
  }
  return input;
}

function decodeTimestampCursor(cursor: string): TimestampCursorState {
  const parsed = JSON.parse(cursor) as Partial<TimestampCursorState>;
  if (typeof parsed.timestamp !== "string" || typeof parsed.id !== "string" || parsed.timestamp.length === 0 || parsed.id.length === 0) {
    throw new Error("release.invalid_cursor");
  }
  return parsed as TimestampCursorState;
}

/**
 * Standalone repository boundary for release / deployment / environment readiness
 * and enterprise rollout evidence records.
 */
export class ReleaseRepository {
  public constructor(private readonly db: AuthoritativeSqlDatabase) {}

  public insertReleaseBundleRecord(record: ReleaseBundleRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO release_bundles (
        bundle_id, environment, version, commit_sha, image_tag, image_ref, rollout_strategy,
        deployment_namespace, cluster_name, config_path, config_bundle_ref, registry_credential_ref,
        deployment_credential_ref, publish_workflow_path, deploy_workflow_path,
        required_readiness_checks_json, recommended_commands_json, task_id, json_artifact_uri,
        markdown_artifact_uri, generated_at, exported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.bundleId,
      record.environment,
      record.version,
      record.commitSha,
      record.imageTag,
      record.imageRef,
      record.rolloutStrategy,
      record.deploymentNamespace,
      record.clusterName,
      record.configPath,
      record.configBundleRef,
      record.registryCredentialRef,
      record.deploymentCredentialRef,
      record.publishWorkflowPath,
      record.deployWorkflowPath,
      record.requiredReadinessChecksJson,
      record.recommendedCommandsJson,
      record.taskId,
      record.jsonArtifactUri,
      record.markdownArtifactUri,
      record.generatedAt,
      record.exportedAt,
    );
  }

  public insertReleaseExecutionReportRecord(record: ReleaseExecutionReportRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO release_execution_reports (
        execution_id, bundle_id, environment, version, commit_sha, rollout_strategy, image_ref, image_repository,
        registry_secret_ref, registry_secret_provider_kind, registry_secret_resolved, registry_secret_access_mode,
        registry_lease_id, registry_lease_status, registry_lease_expires_at, registry_lease_revoked_at,
        publish_workflow_run_id, publish_workflow_run_url, build_command, publish_command, command_results_json,
        task_id, json_artifact_uri, markdown_artifact_uri, generated_at, exported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.executionId,
      record.bundleId,
      record.environment,
      record.version,
      record.commitSha,
      record.rolloutStrategy,
      record.imageRef,
      record.imageRepository,
      record.registrySecretRef,
      record.registrySecretProviderKind,
      record.registrySecretResolved,
      record.registrySecretAccessMode,
      record.registryLeaseId,
      record.registryLeaseStatus,
      record.registryLeaseExpiresAt,
      record.registryLeaseRevokedAt,
      record.publishWorkflowRunId,
      record.publishWorkflowRunUrl,
      record.buildCommand,
      record.publishCommand,
      record.commandResultsJson,
      record.taskId,
      record.jsonArtifactUri,
      record.markdownArtifactUri,
      record.generatedAt,
      record.exportedAt,
    );
  }

  public insertDeploymentExecutionReportRecord(record: DeploymentExecutionReportRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO deployment_execution_reports (
        execution_id, environment, version, commit_sha, rollout_strategy, target_eligible,
        config_bundle_ref, config_version_id, registry_secret_ref, registry_secret_provider_kind,
        registry_secret_resolved, deployment_secret_ref, deployment_secret_provider_kind,
        deployment_secret_resolved, publish_workflow_run_id, publish_workflow_run_url, deploy_workflow_run_id,
        deploy_workflow_run_url, execution_mode, publish_command, deploy_command, command_results_json,
        release_bundle_id, task_id, json_artifact_uri, markdown_artifact_uri, generated_at, exported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.executionId,
      record.environment,
      record.version,
      record.commitSha,
      record.rolloutStrategy,
      record.targetEligible,
      record.configBundleRef,
      record.configVersionId,
      record.registrySecretRef,
      record.registrySecretProviderKind,
      record.registrySecretResolved,
      record.deploymentSecretRef,
      record.deploymentSecretProviderKind,
      record.deploymentSecretResolved,
      record.publishWorkflowRunId,
      record.publishWorkflowRunUrl,
      record.deployWorkflowRunId,
      record.deployWorkflowRunUrl,
      record.executionMode,
      record.publishCommand,
      record.deployCommand,
      record.commandResultsJson,
      record.releaseBundleId,
      record.taskId,
      record.jsonArtifactUri,
      record.markdownArtifactUri,
      record.generatedAt,
      record.exportedAt,
    );
  }

  public insertEnvironmentPromotionHistoryRecord(record: EnvironmentPromotionHistoryRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO environment_promotion_history (
        promotion_id, source_environment, target_environment, version, commit_sha, rollout_strategy,
        decision_type, decision_status, release_bundle_id, deployment_execution_id, reason_code, actor,
        metadata_json, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.promotionId,
      record.sourceEnvironment,
      record.targetEnvironment,
      record.version,
      record.commitSha,
      record.rolloutStrategy,
      record.decisionType,
      record.decisionStatus,
      record.releaseBundleId,
      record.deploymentExecutionId,
      record.reasonCode,
      record.actor,
      record.metadataJson,
      record.recordedAt,
    );
  }

  public getReleaseBundleRecord(bundleId: string): ReleaseBundleRecord | null {
    return queryOne<ReleaseBundleRecord>(
      this.db.connection,
      `SELECT
         bundle_id AS bundleId,
         environment,
         version,
         commit_sha AS commitSha,
         image_tag AS imageTag,
         image_ref AS imageRef,
         rollout_strategy AS rolloutStrategy,
         deployment_namespace AS deploymentNamespace,
         cluster_name AS clusterName,
         config_path AS configPath,
         config_bundle_ref AS configBundleRef,
         registry_credential_ref AS registryCredentialRef,
         deployment_credential_ref AS deploymentCredentialRef,
         publish_workflow_path AS publishWorkflowPath,
         deploy_workflow_path AS deployWorkflowPath,
         required_readiness_checks_json AS requiredReadinessChecksJson,
         recommended_commands_json AS recommendedCommandsJson,
         task_id AS taskId,
         json_artifact_uri AS jsonArtifactUri,
         markdown_artifact_uri AS markdownArtifactUri,
         generated_at AS generatedAt,
         exported_at AS exportedAt
       FROM release_bundles
       WHERE bundle_id = ?
       LIMIT 1`,
      bundleId,
    ) ?? null;
  }

  public listReleaseBundleRecords(options: {
    environment?: string | null;
    limit?: number;
  } = {}): ReleaseBundleRecord[] {
    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
    const sql = `SELECT
         bundle_id AS bundleId,
         environment,
         version,
         commit_sha AS commitSha,
         image_tag AS imageTag,
         image_ref AS imageRef,
         rollout_strategy AS rolloutStrategy,
         deployment_namespace AS deploymentNamespace,
         cluster_name AS clusterName,
         config_path AS configPath,
         config_bundle_ref AS configBundleRef,
         registry_credential_ref AS registryCredentialRef,
         deployment_credential_ref AS deploymentCredentialRef,
         publish_workflow_path AS publishWorkflowPath,
         deploy_workflow_path AS deployWorkflowPath,
         required_readiness_checks_json AS requiredReadinessChecksJson,
         recommended_commands_json AS recommendedCommandsJson,
         task_id AS taskId,
         json_artifact_uri AS jsonArtifactUri,
         markdown_artifact_uri AS markdownArtifactUri,
         generated_at AS generatedAt,
         exported_at AS exportedAt
       FROM release_bundles`;
    if (options.environment !== undefined) {
      return queryAll<ReleaseBundleRecord>(
        this.db.connection,
        `${sql} WHERE environment = ? ORDER BY exported_at DESC, bundle_id DESC LIMIT ?`,
        options.environment,
        safeLimit,
      );
    }
    return queryAll<ReleaseBundleRecord>(
      this.db.connection,
      `${sql} ORDER BY exported_at DESC, bundle_id DESC LIMIT ?`,
      safeLimit,
    );
  }

  public getDeploymentExecutionReportRecord(executionId: string): DeploymentExecutionReportRecord | null {
    return queryOne<DeploymentExecutionReportRecord>(
      this.db.connection,
      `SELECT
         execution_id AS executionId,
         environment,
         version,
         commit_sha AS commitSha,
         rollout_strategy AS rolloutStrategy,
         target_eligible AS targetEligible,
         config_bundle_ref AS configBundleRef,
         config_version_id AS configVersionId,
         registry_secret_ref AS registrySecretRef,
         registry_secret_provider_kind AS registrySecretProviderKind,
         registry_secret_resolved AS registrySecretResolved,
         deployment_secret_ref AS deploymentSecretRef,
         deployment_secret_provider_kind AS deploymentSecretProviderKind,
         deployment_secret_resolved AS deploymentSecretResolved,
         publish_workflow_run_id AS publishWorkflowRunId,
         publish_workflow_run_url AS publishWorkflowRunUrl,
         deploy_workflow_run_id AS deployWorkflowRunId,
         deploy_workflow_run_url AS deployWorkflowRunUrl,
         execution_mode AS executionMode,
         publish_command AS publishCommand,
         deploy_command AS deployCommand,
         command_results_json AS commandResultsJson,
         release_bundle_id AS releaseBundleId,
         task_id AS taskId,
         json_artifact_uri AS jsonArtifactUri,
         markdown_artifact_uri AS markdownArtifactUri,
         generated_at AS generatedAt,
         exported_at AS exportedAt
       FROM deployment_execution_reports
       WHERE execution_id = ?
       LIMIT 1`,
      executionId,
    ) ?? null;
  }

  public getReleaseExecutionReportRecord(executionId: string): ReleaseExecutionReportRecord | null {
    return queryOne<ReleaseExecutionReportRecord>(
      this.db.connection,
      `SELECT
         execution_id AS executionId,
         bundle_id AS bundleId,
         environment,
         version,
         commit_sha AS commitSha,
         rollout_strategy AS rolloutStrategy,
         image_ref AS imageRef,
         image_repository AS imageRepository,
         registry_secret_ref AS registrySecretRef,
         registry_secret_provider_kind AS registrySecretProviderKind,
         registry_secret_resolved AS registrySecretResolved,
         registry_secret_access_mode AS registrySecretAccessMode,
         registry_lease_id AS registryLeaseId,
         registry_lease_status AS registryLeaseStatus,
         registry_lease_expires_at AS registryLeaseExpiresAt,
         registry_lease_revoked_at AS registryLeaseRevokedAt,
         publish_workflow_run_id AS publishWorkflowRunId,
         publish_workflow_run_url AS publishWorkflowRunUrl,
         build_command AS buildCommand,
         publish_command AS publishCommand,
         command_results_json AS commandResultsJson,
         task_id AS taskId,
         json_artifact_uri AS jsonArtifactUri,
         markdown_artifact_uri AS markdownArtifactUri,
         generated_at AS generatedAt,
         exported_at AS exportedAt
       FROM release_execution_reports
       WHERE execution_id = ?
       LIMIT 1`,
      executionId,
    ) ?? null;
  }

  public listReleaseExecutionReportRecords(options: {
    environment?: string | null;
    limit?: number;
  } = {}): ReleaseExecutionReportRecord[] {
    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
    const sql = `SELECT
         execution_id AS executionId,
         bundle_id AS bundleId,
         environment,
         version,
         commit_sha AS commitSha,
         rollout_strategy AS rolloutStrategy,
         image_ref AS imageRef,
         image_repository AS imageRepository,
         registry_secret_ref AS registrySecretRef,
         registry_secret_provider_kind AS registrySecretProviderKind,
         registry_secret_resolved AS registrySecretResolved,
         registry_secret_access_mode AS registrySecretAccessMode,
         registry_lease_id AS registryLeaseId,
         registry_lease_status AS registryLeaseStatus,
         registry_lease_expires_at AS registryLeaseExpiresAt,
         registry_lease_revoked_at AS registryLeaseRevokedAt,
         publish_workflow_run_id AS publishWorkflowRunId,
         publish_workflow_run_url AS publishWorkflowRunUrl,
         build_command AS buildCommand,
         publish_command AS publishCommand,
         command_results_json AS commandResultsJson,
         task_id AS taskId,
         json_artifact_uri AS jsonArtifactUri,
         markdown_artifact_uri AS markdownArtifactUri,
         generated_at AS generatedAt,
         exported_at AS exportedAt
       FROM release_execution_reports`;
    if (options.environment !== undefined) {
      return queryAll<ReleaseExecutionReportRecord>(
        this.db.connection,
        `${sql} WHERE environment = ? ORDER BY exported_at DESC, execution_id DESC LIMIT ?`,
        options.environment,
        safeLimit,
      );
    }
    return queryAll<ReleaseExecutionReportRecord>(
      this.db.connection,
      `${sql} ORDER BY exported_at DESC, execution_id DESC LIMIT ?`,
      safeLimit,
    );
  }

  public listDeploymentExecutionReportRecords(options: {
    environment?: string | null;
    limit?: number;
  } = {}): DeploymentExecutionReportRecord[] {
    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
    const sql = `SELECT
         execution_id AS executionId,
         environment,
         version,
         commit_sha AS commitSha,
         rollout_strategy AS rolloutStrategy,
         target_eligible AS targetEligible,
         config_bundle_ref AS configBundleRef,
         config_version_id AS configVersionId,
         registry_secret_ref AS registrySecretRef,
         registry_secret_provider_kind AS registrySecretProviderKind,
         registry_secret_resolved AS registrySecretResolved,
         deployment_secret_ref AS deploymentSecretRef,
         deployment_secret_provider_kind AS deploymentSecretProviderKind,
         deployment_secret_resolved AS deploymentSecretResolved,
         publish_workflow_run_id AS publishWorkflowRunId,
         publish_workflow_run_url AS publishWorkflowRunUrl,
         deploy_workflow_run_id AS deployWorkflowRunId,
         deploy_workflow_run_url AS deployWorkflowRunUrl,
         execution_mode AS executionMode,
         publish_command AS publishCommand,
         deploy_command AS deployCommand,
         command_results_json AS commandResultsJson,
         release_bundle_id AS releaseBundleId,
         task_id AS taskId,
         json_artifact_uri AS jsonArtifactUri,
         markdown_artifact_uri AS markdownArtifactUri,
         generated_at AS generatedAt,
         exported_at AS exportedAt
       FROM deployment_execution_reports`;
    if (options.environment !== undefined) {
      return queryAll<DeploymentExecutionReportRecord>(
        this.db.connection,
        `${sql} WHERE environment = ? ORDER BY exported_at DESC, execution_id DESC LIMIT ?`,
        options.environment,
        safeLimit,
      );
    }
    return queryAll<DeploymentExecutionReportRecord>(
      this.db.connection,
      `${sql} ORDER BY exported_at DESC, execution_id DESC LIMIT ?`,
      safeLimit,
    );
  }

  public listEnvironmentPromotionHistoryRecords(options: {
    targetEnvironment?: string | null;
    limit?: number;
  } = {}): EnvironmentPromotionHistoryRecord[] {
    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
    const sql = `SELECT
         promotion_id AS promotionId,
         source_environment AS sourceEnvironment,
         target_environment AS targetEnvironment,
         version,
         commit_sha AS commitSha,
         rollout_strategy AS rolloutStrategy,
         decision_type AS decisionType,
         decision_status AS decisionStatus,
         release_bundle_id AS releaseBundleId,
         deployment_execution_id AS deploymentExecutionId,
         reason_code AS reasonCode,
         actor,
         metadata_json AS metadataJson,
         recorded_at AS recordedAt
       FROM environment_promotion_history`;
    if (options.targetEnvironment !== undefined) {
      return queryAll<EnvironmentPromotionHistoryRecord>(
        this.db.connection,
        `${sql} WHERE target_environment = ? ORDER BY recorded_at DESC, promotion_id DESC LIMIT ?`,
        options.targetEnvironment,
        safeLimit,
      );
    }
    return queryAll<EnvironmentPromotionHistoryRecord>(
      this.db.connection,
      `${sql} ORDER BY recorded_at DESC, promotion_id DESC LIMIT ?`,
      safeLimit,
    );
  }

  public upsertEnvironmentReadinessRecord(record: EnvironmentReadinessRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO environment_readiness_records (
        readiness_id, environment, component_type, component_id, credential_ready, secondary_gates_json,
        owner, last_verified_at, is_active, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(environment, component_type, component_id, is_active) DO UPDATE SET
        readiness_id = excluded.readiness_id,
        credential_ready = excluded.credential_ready,
        secondary_gates_json = excluded.secondary_gates_json,
        owner = excluded.owner,
        last_verified_at = excluded.last_verified_at,
        notes = excluded.notes`,
      record.readinessId,
      record.environment,
      record.componentType,
      record.componentId,
      record.credentialReady,
      record.secondaryGatesJson,
      record.owner,
      record.lastVerifiedAt,
      record.isActive,
      record.notes,
    );
  }

  public getActiveEnvironmentReadinessRecord(
    environment: EnvironmentReadinessRecord["environment"],
    componentType: EnvironmentReadinessRecord["componentType"],
    componentId: string,
  ): EnvironmentReadinessRecord | null {
    return queryOne<EnvironmentReadinessRecord>(
      this.db.connection,
      `SELECT
         readiness_id AS readinessId,
         environment,
         component_type AS componentType,
         component_id AS componentId,
         credential_ready AS credentialReady,
         secondary_gates_json AS secondaryGatesJson,
         owner,
         last_verified_at AS lastVerifiedAt,
         is_active AS isActive,
         notes
       FROM environment_readiness_records
       WHERE environment = ? AND component_type = ? AND component_id = ? AND is_active = 1
       ORDER BY last_verified_at DESC
       LIMIT 1`,
      environment,
      componentType,
      componentId,
    ) ?? null;
  }

  public listEnvironmentReadinessRecords(
    environment?: EnvironmentReadinessRecord["environment"] | null,
    options: { activeOnly?: boolean; limit?: number } = {},
  ): EnvironmentReadinessRecord[] {
    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
    if (environment != null && environment.length > 0) {
      return queryAll<EnvironmentReadinessRecord>(
        this.db.connection,
        `SELECT
           readiness_id AS readinessId,
           environment,
           component_type AS componentType,
           component_id AS componentId,
           credential_ready AS credentialReady,
           secondary_gates_json AS secondaryGatesJson,
           owner,
           last_verified_at AS lastVerifiedAt,
           is_active AS isActive,
           notes
         FROM environment_readiness_records
         WHERE environment = ?
           AND (? = 0 OR is_active = 1)
         ORDER BY last_verified_at DESC, readiness_id DESC
         LIMIT ?`,
        environment,
        options.activeOnly === false ? 0 : 1,
        safeLimit,
      );
    }
    return queryAll<EnvironmentReadinessRecord>(
      this.db.connection,
      `SELECT
         readiness_id AS readinessId,
         environment,
         component_type AS componentType,
         component_id AS componentId,
         credential_ready AS credentialReady,
         secondary_gates_json AS secondaryGatesJson,
         owner,
         last_verified_at AS lastVerifiedAt,
         is_active AS isActive,
         notes
       FROM environment_readiness_records
       WHERE (? = 0 OR is_active = 1)
       ORDER BY last_verified_at DESC, readiness_id DESC
       LIMIT ?`,
      options.activeOnly === false ? 0 : 1,
      safeLimit,
    );
  }

  public insertEnterpriseCapabilityReport(report: EnterpriseCapabilityReportRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO enterprise_capability_reports (
        report_id, account_id, workspace_id, tenant_id, environment, deployment_mode, summary_json, report_json, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      report.reportId,
      report.accountId,
      report.workspaceId,
      report.tenantId,
      report.environment,
      report.deploymentMode,
      report.summaryJson,
      report.reportJson,
      report.generatedAt,
    );
  }

  public insertIncidentHandoffRecord(record: IncidentHandoffRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO incident_handoff_records (
        handoff_id, incident_id, environment, status, shift_owner, primary_oncall, secondary_oncall,
        severity, handoff_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.handoffId,
      record.incidentId,
      record.environment,
      record.status,
      record.shiftOwner,
      record.primaryOncall,
      record.secondaryOncall,
      record.severity,
      record.handoffJson,
      record.createdAt,
    );
  }

  public insertEnterpriseGovernanceReport(report: EnterpriseGovernanceReportRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO enterprise_governance_reports (
        report_id, task_id, environment, status, shift_owner, summary_json, report_json, generated_at, handoff_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      report.reportId,
      report.taskId,
      report.environment,
      report.status,
      report.shiftOwner,
      report.summaryJson,
      report.reportJson,
      report.generatedAt,
      report.handoffId,
    );
  }

  public listEnterpriseCapabilityReports(limit: number | ReportCursorPageOptions = 20): EnterpriseCapabilityReportRecord[] {
    const page = normalizeReportCursorPage(limit);
    const cursorState = page.cursor == null ? null : decodeTimestampCursor(page.cursor);
    const safeLimit = Number.isFinite(page.limit) ? Math.max(1, Math.trunc(page.limit ?? 20)) : 20;
    const params: Array<string | number | null> = [];
    const where: string[] = [];
    if (page.tenantId !== undefined) {
      where.push("tenant_id = ?");
      params.push(page.tenantId ?? null);
    }
    if (cursorState != null) {
      where.push("(generated_at < ? OR (generated_at = ? AND report_id > ?))");
      params.push(cursorState.timestamp, cursorState.timestamp, cursorState.id);
    }
    params.push(safeLimit);
    return queryAll<EnterpriseCapabilityReportRecord>(
      this.db.connection,
      `SELECT
         report_id AS reportId,
         account_id AS accountId,
         workspace_id AS workspaceId,
         tenant_id AS tenantId,
         environment,
         deployment_mode AS deploymentMode,
         summary_json AS summaryJson,
         report_json AS reportJson,
         generated_at AS generatedAt
       FROM enterprise_capability_reports
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY generated_at DESC, report_id ASC
       LIMIT ?`,
      ...params,
    );
  }

  public listIncidentHandoffRecords(limit: number | CursorPageOptions = 20): IncidentHandoffRecord[] {
    const page = normalizeCursorPage(limit);
    const cursorState = page.cursor == null ? null : decodeTimestampCursor(page.cursor);
    const safeLimit = Number.isFinite(page.limit) ? Math.max(1, Math.trunc(page.limit ?? 20)) : 20;
    const params: Array<string | number> = [];
    const where: string[] = [];
    if (cursorState != null) {
      where.push("(created_at < ? OR (created_at = ? AND handoff_id > ?))");
      params.push(cursorState.timestamp, cursorState.timestamp, cursorState.id);
    }
    params.push(safeLimit);
    return queryAll<IncidentHandoffRecord>(
      this.db.connection,
      `SELECT
         handoff_id AS handoffId,
         incident_id AS incidentId,
         environment,
         status,
         shift_owner AS shiftOwner,
         primary_oncall AS primaryOncall,
         secondary_oncall AS secondaryOncall,
         severity,
         handoff_json AS handoffJson,
         created_at AS createdAt
       FROM incident_handoff_records
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC, handoff_id ASC
       LIMIT ?`,
      ...params,
    );
  }

  public listEnterpriseGovernanceReports(limit: number | CursorPageOptions = 20): EnterpriseGovernanceReportRecord[] {
    const page = normalizeCursorPage(limit);
    const cursorState = page.cursor == null ? null : decodeTimestampCursor(page.cursor);
    const safeLimit = Number.isFinite(page.limit) ? Math.max(1, Math.trunc(page.limit ?? 20)) : 20;
    const params: Array<string | number> = [];
    const where: string[] = [];
    if (cursorState != null) {
      where.push("(generated_at < ? OR (generated_at = ? AND report_id > ?))");
      params.push(cursorState.timestamp, cursorState.timestamp, cursorState.id);
    }
    params.push(safeLimit);
    return queryAll<EnterpriseGovernanceReportRecord>(
      this.db.connection,
      `SELECT
         report_id AS reportId,
         task_id AS taskId,
         environment,
         status,
         shift_owner AS shiftOwner,
         summary_json AS summaryJson,
         report_json AS reportJson,
         generated_at AS generatedAt,
         handoff_id AS handoffId
       FROM enterprise_governance_reports
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY generated_at DESC, report_id ASC
       LIMIT ?`,
      ...params,
    );
  }
}
