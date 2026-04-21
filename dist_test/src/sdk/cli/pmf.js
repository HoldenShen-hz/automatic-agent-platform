/**
 * Product-Market Fit Validation CLI
 *
 * This module provides the command-line entry point for PMF validation operations.
 * It runs validation checks to assess product-market fit metrics and generates
 * reports on division performance, profile validation, and historical trends.
 *
 * Environment Variables:
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_PMF_ACTION: Action to perform (report, run, export, history, latest)
 *   - AA_PMF_PROFILE_NAME: Optional profile name for validation
 *   - AA_PMF_DIVISION_ID: Optional division ID to scope validation
 *   - AA_PMF_WINDOW_DAYS: Optional time window in days for analysis
 *   - AA_PMF_EVALUATED_AT: Optional timestamp for historical evaluation
 *   - AA_PMF_LIMIT: Optional limit for history queries
 *   - AA_ARTIFACT_ROOT: Root directory for artifact storage
 *
 * Actions:
 *   - report: Build and return a PMF validation report
 *   - run: Run validation checks
 *   - export: Export validation results
 *   - history: List historical validation results
 *   - latest: Get the most recent validation result
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
import { withCliStorage } from "./authoritative-storage.js";
import { loadPmfCliEnv } from "../../platform/control-plane/config-center/product-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { PmfValidationService } from "../../scale-ecosystem/marketplace/pmf-validation-service.js";
/**
 * Main entry point for the PMF validation CLI.
 *
 * Initializes storage, creates the PMF validation service, dispatches the requested action,
 * outputs the result as JSON, and closes the storage connection.
 */
function main() {
    const envConfig = loadPmfCliEnv();
    const output = withCliStorage((storage) => {
        const pmf = new PmfValidationService(storage.sql, storage.store, {
            rootDir: envConfig.artifactRoot,
        });
        const options = {
            ...(envConfig.profileName ? { profileName: envConfig.profileName } : {}),
            ...(envConfig.divisionId !== null ? { divisionId: envConfig.divisionId } : {}),
            ...(envConfig.windowDays != null ? { windowDays: envConfig.windowDays } : {}),
            ...(envConfig.evaluatedAt ? { evaluatedAt: envConfig.evaluatedAt } : {}),
        };
        switch (envConfig.action) {
            case "report":
                return pmf.buildReport(options);
            case "run":
                return pmf.runValidation(options);
            case "export":
                return pmf.exportValidation(options);
            case "history":
                return pmf.listHistory(envConfig.limit ?? 20);
            case "latest":
                return pmf.getLatest(envConfig.profileName);
            default:
                throw new ValidationError(`unknown_pmf_action:${envConfig.action}`, `unknown_pmf_action:${envConfig.action}`);
        }
    }, { dbPath: envConfig.dbPath });
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}
main();
//# sourceMappingURL=pmf.js.map