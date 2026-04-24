/**
 * Enterprise Capability Matrix CLI
 *
 * This module provides a command-line interface for managing environment readiness
 * assessment and capability matrix reporting. It tracks which enterprise capabilities
 * are available per environment and deployment mode.
 *
 * Environment Variables (via loadEnterpriseCapabilityCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_ENTERPRISE_CAPABILITY_ACTION: Action to perform
 *   - AA_ENTERPRISE_CAPABILITY_ARTIFACT_ROOT: Optional artifact root directory
 *
 * Actions:
 *   - register_readiness: Register environment readiness status for a component
 *   - summary: Build capability matrix summary
 *   - export: Export capability matrix with evidence
 *   - list_readiness: List all readiness registrations
 *   - list_reports: List generated reports
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for enterprise capability architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for capability terminology
 */

import { dirname } from "node:path";

import { withCliStorage } from "./authoritative-storage.js";
import { loadEnterpriseCapabilityCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { EnterpriseCapabilityMatrixService } from "../../scale-ecosystem/enterprise/enterprise-capability-matrix-service.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";

const envConfig = loadEnterpriseCapabilityCliEnv();
const result = withCliStorage((storage) => {
  const service = envConfig.artifactRoot == null || envConfig.artifactRoot.length === 0
    ? new EnterpriseCapabilityMatrixService(storage.sql, storage.store)
    : new EnterpriseCapabilityMatrixService(storage.sql, storage.store, {
      artifactStoreOptions: {
        rootDir: envConfig.artifactRoot,
        sandboxPolicy: createWorkspaceWritePolicy(dirname(envConfig.artifactRoot)),
      },
    });

  switch (envConfig.action) {
    case "register_readiness":
      return service.registerEnvironmentReadiness({
        ...(envConfig.readinessId ? { readinessId: envConfig.readinessId } : {}),
        environment: envConfig.environment ?? "dev",
        componentType: envConfig.componentType ?? "provider",
        componentId: envConfig.componentId ?? "",
        credentialReady: envConfig.credentialReady,
        ...(envConfig.secondaryGates ? { secondaryGates: envConfig.secondaryGates } : {}),
        owner: envConfig.owner ?? "",
        ...(envConfig.lastVerifiedAt ? { lastVerifiedAt: envConfig.lastVerifiedAt } : {}),
        isActive: envConfig.isActive,
        notes: envConfig.notes,
      });
    case "summary":
      return service.buildMatrix({
        accountId: envConfig.accountId,
        workspaceId: envConfig.workspaceId,
        tenantId: envConfig.tenantId,
        environment: envConfig.environment ?? "dev",
        deploymentMode: envConfig.deploymentMode ?? "cloud_shared",
        ...(envConfig.generatedAt ? { generatedAt: envConfig.generatedAt } : {}),
      });
    case "export":
      return service.exportMatrix({
        accountId: envConfig.accountId,
        workspaceId: envConfig.workspaceId,
        tenantId: envConfig.tenantId,
        environment: envConfig.environment ?? "dev",
        deploymentMode: envConfig.deploymentMode ?? "cloud_shared",
        ...(envConfig.generatedAt ? { generatedAt: envConfig.generatedAt } : {}),
      });
    case "list_readiness":
      return service.listEnvironmentReadiness(envConfig.environment ?? undefined);
    case "list_reports":
      return service.listReports(envConfig.limit ?? 20);
    default:
      throw new ValidationError(`unknown_enterprise_action:${envConfig.action}`, `unknown_enterprise_action:${envConfig.action}`);
  }
}, { dbPath: envConfig.dbPath });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
