/**
 * Workflow Dispatch Receipt Parser
 *
 * Parses command output from GitHub workflow dispatch commands to extract
 * run identifiers and URLs. Used by deployment services to track workflow
 * executions after triggering them via the `gh workflow run` command.
 */
export interface WorkflowDispatchReceipt {
    runId: string | null;
    runUrl: string | null;
}
/**
 * Extracts workflow dispatch receipt information from command output.
 * First tries to find a run URL (preferred), then falls back to run ID extraction.
 *
 * @param output - The stdout/stderr output from a workflow dispatch command
 * @returns WorkflowDispatchReceipt with runId and/or runUrl if found
 */
export declare function extractWorkflowDispatchReceipt(output: string): WorkflowDispatchReceipt;
