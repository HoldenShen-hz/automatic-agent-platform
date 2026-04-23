/**
 * Inspect CLI Tool
 *
 * This module provides a command-line interface for inspecting detailed
 * information about tasks, executions, and approvals stored in the authoritative
 * SQLite database. The appropriate view is selected based on the AA_INSPECT_KIND
 * environment variable and the corresponding ID.
 *
 * Environment Variables:
 *   - AA_INSPECT_KIND (required): Type of entity to inspect (task, execution, approval)
 *   - AA_TASK_ID: Required when AA_INSPECT_KIND is "task"
 *   - AA_EXECUTION_ID: Required when AA_INSPECT_KIND is "execution"
 *   - AA_APPROVAL_ID: Required when AA_INSPECT_KIND is "approval"
 *   - AA_DB_PATH: Path to SQLite database (defaults to data/sqlite/authoritative-demo.db)
 *
 * Usage:
 *   AA_INSPECT_KIND=task AA_TASK_ID=<id> npm run inspect
 *   AA_INSPECT_KIND=execution AA_EXECUTION_ID=<id> npm run inspect
 *   AA_INSPECT_KIND=approval AA_APPROVAL_ID=<id> npm run inspect
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for authoritative runtime architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for task, execution, and approval terminology
 * @see {@link docs_zh/contracts/} for observability contracts
 */
import { withCliStorage } from "./authoritative-storage.js";
import { loadInspectCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { InspectService, } from "../../platform/shared/observability/inspect-service.js";
/**
 * Main entry point for the inspect CLI tool.
 *
 * Initializes the database and InspectService, then dispatches to the
 * appropriate inspection method based on the AA_INSPECT_KIND environment
 * variable. Supports inspection of tasks, executions, and approvals.
 * Outputs the inspection result as formatted JSON.
 *
 * @throws Error if AA_INSPECT_KIND is not one of the supported types
 */
function main() {
    const envConfig = loadInspectCliEnv();
    const output = withCliStorage((storage) => {
        const inspect = new InspectService(storage.store);
        switch (envConfig.kind) {
            case "task":
                if (envConfig.taskId == null) {
                    throw new ValidationError("missing_env:AA_TASK_ID", "missing_env:AA_TASK_ID");
                }
                return inspect.getTaskInspectView(envConfig.taskId);
            case "execution":
                if (envConfig.executionId == null) {
                    throw new ValidationError("missing_env:AA_EXECUTION_ID", "missing_env:AA_EXECUTION_ID");
                }
                return inspect.getExecutionInspectView(envConfig.executionId);
            case "approval":
                if (envConfig.approvalId == null) {
                    throw new ValidationError("missing_env:AA_APPROVAL_ID", "missing_env:AA_APPROVAL_ID");
                }
                return inspect.getApprovalInspectView(envConfig.approvalId);
            case "tasks": {
                const query = {};
                if (envConfig.limit != null) {
                    query.limit = envConfig.limit;
                }
                if (envConfig.taskStatus) {
                    query.taskStatus = envConfig.taskStatus;
                }
                if (envConfig.workflowStatus) {
                    query.workflowStatus = envConfig.workflowStatus;
                }
                if (envConfig.workflowId) {
                    query.workflowId = envConfig.workflowId;
                }
                if (envConfig.divisionId) {
                    query.divisionId = envConfig.divisionId;
                }
                if (envConfig.hasPendingApproval != null) {
                    query.hasPendingApproval = envConfig.hasPendingApproval;
                }
                return inspect.queryTaskInspectSummaries(query);
            }
            case "workflows": {
                const query = {};
                if (envConfig.limit != null) {
                    query.limit = envConfig.limit;
                }
                if (envConfig.workflowId) {
                    query.workflowId = envConfig.workflowId;
                }
                if (envConfig.workflowStatus) {
                    query.workflowStatus = envConfig.workflowStatus;
                }
                if (envConfig.divisionId) {
                    query.divisionId = envConfig.divisionId;
                }
                if (envConfig.taskStatus) {
                    query.taskStatus = envConfig.taskStatus;
                }
                return inspect.queryWorkflowInspectSummaries(query);
            }
            case "decisions": {
                const query = {};
                if (envConfig.limit != null) {
                    query.limit = envConfig.limit;
                }
                if (envConfig.decisionType) {
                    query.decisionType = envConfig.decisionType;
                }
                if (envConfig.decisionStatus) {
                    query.status = envConfig.decisionStatus;
                }
                if (envConfig.taskId) {
                    query.taskId = envConfig.taskId;
                }
                if (envConfig.executionId) {
                    query.executionId = envConfig.executionId;
                }
                return inspect.queryDecisionInspectSummaries(query);
            }
            case "workers": {
                const query = {};
                if (envConfig.limit != null) {
                    query.limit = envConfig.limit;
                }
                if (envConfig.workerStatus) {
                    query.status = envConfig.workerStatus;
                }
                if (envConfig.placement) {
                    query.placement = envConfig.placement;
                }
                if (envConfig.remoteSessionStatus) {
                    query.remoteSessionStatus = envConfig.remoteSessionStatus;
                }
                if (envConfig.queueAffinity) {
                    query.queueAffinity = envConfig.queueAffinity;
                }
                return inspect.queryWorkerInspectSummaries(query);
            }
            default:
                throw new ValidationError(`unknown_inspect_kind:${envConfig.kind}`, `unknown_inspect_kind:${envConfig.kind}`);
        }
    }, envConfig.dbPath != null ? { dbPath: envConfig.dbPath } : {});
    console.log(JSON.stringify(output, null, 2));
}
main();
//# sourceMappingURL=inspect.js.map