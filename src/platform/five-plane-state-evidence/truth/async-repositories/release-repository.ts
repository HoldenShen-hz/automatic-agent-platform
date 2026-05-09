/**
 * AsyncReleaseRepository - Async data access for release bundles, deployment execution reports, and environment readiness.
 */

import type {
  DeploymentExecutionReportRecord,
  EnterpriseCapabilityReportRecord,
  EnterpriseGovernanceReportRecord,
  EnvironmentPromotionHistoryRecord,
  EnvironmentReadinessRecord,
  IncidentHandoffRecord,
  ReleaseBundleRecord,
  ReleaseExecutionReportRecord,
} from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";

export class AsyncReleaseRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  public async insertReleaseBundleRecord(record: ReleaseBundleRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO release_bundles (
        bundle_id, environment, version, commit_sha, image_tag, image_ref, rollout_strategy,
        deployment_namespace, cluster_name, config_path, config_bundle_ref, registry_credential_ref,
        deployment_credential_ref, publish_workflow_path, deploy_workflow_path,
        required_readiness_checks_json, recommended_commands_json, task_id, json_artifact_uri,
        markdown_artifact_uri, generated_at, exported_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
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

  public async insertReleaseExecutionReportRecord(record: ReleaseExecutionReportRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO release_execution_reports (
        execution_id, bundle_id, environment, version, commit_sha, rollout_strategy, image_ref, image_repository,
        registry_secret_ref, registry_secret_provider_kind, registry_secret_resolved, registry_secret_access_mode,
        registry_lease_id, registry_lease_status, registry_lease_expires_at, registry_lease_revoked_at,
        publish_workflow_run_id, publish_workflow_run_url, build_command, publish_command, command_results_json,
        task_id, json_artifact_uri, markdown_artifact_uri, generated_at, exported_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
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

  public async insertDeploymentExecutionReportRecord(record: DeploymentExecutionReportRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO deployment_execution_reports (
        execution_id, environment, version, commit_sha, rollout_strategy, target_eligible,
        config_bundle_ref, config_version_id, registry_secret_ref, registry_secret_provider_kind,
        registry_secret_resolved, deployment_secret_ref, deployment_secret_provider_kind,
        deployment_secret_resolved, publish_workflow_run_id, publish_workflow_run_url, deploy_workflow_run_id,
        deploy_workflow_run_url, execution_mode, publish_command, deploy_command, command_results_json,
        release_bundle_id, task_id, json_artifact_uri, markdown_artifact_uri, generated_at, exported_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`,
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

  public async insertEnvironmentPromotionHistoryRecord(record: EnvironmentPromotionHistoryRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO environment_promotion_history (
        promotion_id, source_environment, target_environment, version, commit_sha, rollout_strategy,
        decision_type, decision_status, release_bundle_id, deployment_execution_id, reason_code, actor,
        metadata_json, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
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

  public async getReleaseBundleRecord(bundleId: string): Promise<ReleaseBundleRecord | null> {
    const result = await asyncQueryOne<ReleaseBundleRecord>(
      this.conn,
      `SELECT
         bundle_id AS "bundleId",
         environment,
         version,
         commit_sha AS "commitSha",
         image_tag AS "imageTag",
         image_ref AS "imageRef",
         rollout_strategy AS "rolloutStrategy",
         deployment_namespace AS "deploymentNamespace",
         cluster_name AS "clusterName",
         config_path AS "configPath",
         config_bundle_ref AS "configBundleRef",
         registry_credential_ref AS "registryCredentialRef",
         deployment_credential_ref AS "deploymentCredentialRef",
         publish_workflow_path AS "publishWorkflowPath",
         deploy_workflow_path AS "deployWorkflowPath",
         required_readiness_checks_json AS "requiredReadinessChecksJson",
         recommended_commands_json AS "recommendedCommandsJson",
         task_id AS "taskId",
         json_artifact_uri AS "jsonArtifactUri",
         markdown_artifact_uri AS "markdownArtifactUri",
         generated_at AS "generatedAt",
         exported_at AS "exportedAt"
       FROM release_bundles
       WHERE bundle_id = $1
       LIMIT 1`,
      bundleId,
    );
    return result ?? null;
  }

  public async listReleaseBundleRecords(options: {
    environment?: string | null;
    limit?: number;
  } = {}): Promise<ReleaseBundleRecord[]> {
    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
    const sql = `SELECT
         bundle_id AS "bundleId",
         environment,
         version,
         commit_sha AS "commitSha",
         image_tag AS "imageTag",
         image_ref AS "imageRef",
         rollout_strategy AS "rolloutStrategy",
         deployment_namespace AS "deploymentNamespace",
         cluster_name AS "clusterName",
         config_path AS "configPath",
         config_bundle_ref AS "configBundleRef",
         registry_credential_ref AS "registryCredentialRef",
         deployment_credential_ref AS "deploymentCredentialRef",
         publish_workflow_path AS "publishWorkflowPath",
         deploy_workflow_path AS "deployWorkflowPath",
         required_readiness_checks_json AS "requiredReadinessChecksJson",
         recommended_commands_json AS "recommendedCommandsJson",
         task_id AS "taskId",
         json_artifact_uri AS "jsonArtifactUri",
         markdown_artifact_uri AS "markdownArtifactUri",
         generated_at AS "generatedAt",
         exported_at AS "exportedAt"
       FROM release_bundles`;
    if (options.environment !== undefined) {
      return asyncQueryAll<ReleaseBundleRecord>(
        this.conn,
        `${sql} WHERE environment = $1 ORDER BY exported_at DESC, bundle_id DESC LIMIT $2`,
        options.environment,
        safeLimit,
      );
    }
    return asyncQueryAll<ReleaseBundleRecord>(
      this.conn,
      `${sql} ORDER BY exported_at DESC, bundle_id DESC LIMIT $1`,
      safeLimit,
    );
  }

  public async insertEnterpriseCapabilityReport(report: EnterpriseCapabilityReportRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO enterprise_capability_reports (
        report_id, account_id, workspace_id, tenant_id, environment, deployment_mode, summary_json, report_json, generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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

  public async insertIncidentHandoffRecord(record: IncidentHandoffRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO incident_handoff_records (
        handoff_id, incident_id, environment, status, shift_owner, primary_oncall, secondary_oncall,
        severity, handoff_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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

  public async insertEnterpriseGovernanceReport(report: EnterpriseGovernanceReportRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO enterprise_governance_reports (
        report_id, task_id, environment, status, shift_owner, summary_json, report_json, generated_at, handoff_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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

  public async listEnterpriseCapabilityReports(limit = 20): Promise<EnterpriseCapabilityReportRecord[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
    return asyncQueryAll<EnterpriseCapabilityReportRecord>(
      this.conn,
      `SELECT
         report_id AS "reportId",
         account_id AS "accountId",
         workspace_id AS "workspaceId",
         tenant_id AS "tenantId",
         environment,
         deployment_mode AS "deploymentMode",
         summary_json AS "summaryJson",
         report_json AS "reportJson",
         generated_at AS "generatedAt"
       FROM enterprise_capability_reports
       ORDER BY generated_at DESC
       LIMIT $1`,
      safeLimit,
    );
  }

  public async listIncidentHandoffRecords(limit = 20): Promise<IncidentHandoffRecord[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
    return asyncQueryAll<IncidentHandoffRecord>(
      this.conn,
      `SELECT
         handoff_id AS "handoffId",
         incident_id AS "incidentId",
         environment,
         status,
         shift_owner AS "shiftOwner",
         primary_oncall AS "primaryOncall",
         secondary_oncall AS "secondaryOncall",
         severity,
         handoff_json AS "handoffJson",
         created_at AS "createdAt"
       FROM incident_handoff_records
       ORDER BY created_at DESC
       LIMIT $1`,
      safeLimit,
    );
  }

  public async listEnterpriseGovernanceReports(limit = 20): Promise<EnterpriseGovernanceReportRecord[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
    return asyncQueryAll<EnterpriseGovernanceReportRecord>(
      this.conn,
      `SELECT
         report_id AS "reportId",
         task_id AS "taskId",
         environment,
         status,
         shift_owner AS "shiftOwner",
         summary_json AS "summaryJson",
         report_json AS "reportJson",
         generated_at AS "generatedAt",
         handoff_id AS "handoffId"
       FROM enterprise_governance_reports
       ORDER BY generated_at DESC
       LIMIT $1`,
      safeLimit,
    );
  }
}
