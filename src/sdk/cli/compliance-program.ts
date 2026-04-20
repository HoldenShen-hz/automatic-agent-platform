/**
 * Compliance Program CLI
 *
 * This module provides a command-line interface for compliance program reporting.
 * It generates compliance reports based on configured policies and evidence,
 * supporting both summary and export formats.
 *
 * Environment Variables:
 *   - AA_DB_PATH: Path to the SQLite database (required)
 *   - AA_COMPLIANCE_PROGRAM_ACTION: Action to perform - "summary" (default) or "export"
 *   - AA_COMPLIANCE_PROGRAM_ARTIFACT_ROOT: Optional root directory for artifact storage
 *
 * Actions:
 *   - summary: Build and return compliance report (default)
 *   - export: Export compliance report with all evidence
 *
 * @see {@link docs_zh/automatic_agent_patform_arthitecture_design.md} for compliance architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for compliance terminology
 */

import { deriveCliWorkspaceRoot, withCliStorage } from "./authoritative-storage.js";
import { loadComplianceProgramCliEnv } from "../../platform/control-plane/config-center/product-cli-env.js";
import { ComplianceProgramService } from "../../scale-ecosystem/marketplace/compliance-program-service.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";
const envConfig = loadComplianceProgramCliEnv();

const result = withCliStorage((storage) => {
  const workspaceRoot = deriveCliWorkspaceRoot(envConfig.dbPath);
  const service = envConfig.artifactRoot
    ? new ComplianceProgramService(storage.store, {
      artifactStoreOptions: {
        rootDir: envConfig.artifactRoot,
        sandboxPolicy: createWorkspaceWritePolicy(workspaceRoot),
      },
    })
    : new ComplianceProgramService(storage.store);

  return envConfig.action === "export" ? service.exportReport() : service.buildReport();
}, { dbPath: envConfig.dbPath });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
