/**
 * Data Plane CLI
 *
 * This module provides the command-line entry point for data plane operations.
 * It manages analytics facts, archive bundles, replay datasets, and data movement jobs
 * within the Automatic Agent system.
 *
 * Environment Variables (via loadDataPlaneCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_DATA_PLANE_ACTION: Action to perform
 *   - AA_ARTIFACT_ROOT: Root directory for artifact storage
 *   - AA_NAMESPACE_ID: Namespace identifier for multi-tenant operations
 *   - AA_TENANT_ID: Tenant identifier
 *   - AA_SOURCE_NAMESPACE_ID: Source namespace for movement operations
 *   - AA_TARGET_NAMESPACE_ID: Target namespace for movement operations
 *
 * Actions:
 *   - create_analytics_fact: Create an analytics fact record
 *   - create_archive_bundle: Create an archive bundle
 *   - create_replay_dataset: Create a replay dataset
 *   - start_movement_job: Start a data movement job
 *   - complete_movement_job: Complete a data movement job
 *   - summary: Build and return a data plane summary
 *   - export: Export the data plane summary
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */

import { withCliStorage } from "./authoritative-storage.js";
import { loadDataPlaneCliEnv } from "../../platform/control-plane/config-center/operations-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { DataPlaneFlowService } from "../../scale-ecosystem/marketplace/data-plane-flow-service.js";

const envConfig = loadDataPlaneCliEnv();
const action = envConfig.action;
const result = withCliStorage((storage) => {
  const service = new DataPlaneFlowService(storage.sql, storage.store, {
    ...(envConfig.artifactRoot
      ? {
          artifactStoreOptions: {
            rootDir: envConfig.artifactRoot,
          },
        }
      : {}),
  });

  switch (action) {
    case "create_analytics_fact":
      return service.createAnalyticsFact({
        namespaceId: envConfig.namespaceId ?? "",
        ...(envConfig.factId ? { factId: envConfig.factId } : {}),
        metricName: envConfig.metricName ?? "",
        ...(envConfig.dimensions != null ? { dimensions: envConfig.dimensions } : {}),
        value: envConfig.value ?? Number.NaN,
        windowStart: envConfig.windowStart ?? "",
        windowEnd: envConfig.windowEnd ?? "",
        sourceRef: envConfig.sourceRef ?? "",
      });
    case "create_archive_bundle":
      return service.createArchiveBundle({
        namespaceId: envConfig.namespaceId ?? "",
        ...(envConfig.bundleId ? { bundleId: envConfig.bundleId } : {}),
        bundleType: envConfig.bundleType ?? "",
        sourceRefs: envConfig.sourceRefs,
        summaryRef: envConfig.summaryRef ?? "",
      });
    case "create_replay_dataset":
      return service.createReplayDataset({
        namespaceId: envConfig.namespaceId ?? "",
        ...(envConfig.datasetId ? { datasetId: envConfig.datasetId } : {}),
        datasetType: envConfig.datasetType ?? "",
        sampleRefs: envConfig.sampleRefs,
        truthRefs: envConfig.truthRefs,
        version: envConfig.version ?? "",
      });
    case "start_movement_job":
      return service.startMovementJob({
        ...(envConfig.jobId ? { jobId: envConfig.jobId } : {}),
        sourceNamespaceId: envConfig.sourceNamespaceId ?? "",
        targetNamespaceId: envConfig.targetNamespaceId ?? "",
        movementType: (envConfig.movementType ?? "") as
          | "analytics_etl"
          | "archive_compaction"
          | "replay_dataset_build"
          | "artifact_lifecycle_move",
        inputRefs: envConfig.inputRefs,
      });
    case "complete_movement_job":
      return service.completeMovementJob({
        jobId: envConfig.jobId ?? "",
        ...(envConfig.status ? { status: envConfig.status } : {}),
        ...(envConfig.report != null ? { report: envConfig.report } : {}),
      });
    case "export":
      return service.exportSummary({
        tenantId: envConfig.tenantId,
      });
    case "summary":
      return service.buildSummary({
        tenantId: envConfig.tenantId,
      });
    default:
      throw new ValidationError(`unknown_data_plane_action:${action}`, `unknown_data_plane_action:${action}`);
  }
}, { dbPath: envConfig.dbPath });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
