/**
 * Workflow Dispatch Receipt Parser
 *
 * Parses command output from GitHub workflow dispatch commands to extract
 * run identifiers and URLs. Used by deployment services to track workflow
 * executions after triggering them via the `gh workflow run` command.
 */
/**
 * Regular expression pattern for extracting GitHub Actions run URLs.
 * Matches URLs in the format: https://github.com/owner/repo/actions/runs/123456
 */
const RUN_URL_PATTERN = /https:\/\/github\.com\/[^\s)]+\/actions\/runs\/(\d+)/i;
/**
 * Regular expression pattern for extracting run IDs from text.
 * Matches various formats like "run id: 12345", "workflow run id 12345", etc.
 * Requires at least 5 digits to avoid false positives.
 */
const RUN_ID_PATTERN = /\b(?:run(?:\s+id)?|workflow(?:\s+run)?(?:\s+id)?)[^\d]{0,20}(\d{5,})\b/i;
/**
 * Extracts workflow dispatch receipt information from command output.
 * First tries to find a run URL (preferred), then falls back to run ID extraction.
 *
 * @param output - The stdout/stderr output from a workflow dispatch command
 * @returns WorkflowDispatchReceipt with runId and/or runUrl if found
 */
export function extractWorkflowDispatchReceipt(output) {
    const normalized = output.trim();
    if (normalized.length === 0) {
        return {
            runId: null,
            runUrl: null,
        };
    }
    // Try to match a full run URL first (preferred - more specific)
    const urlMatch = normalized.match(RUN_URL_PATTERN);
    if (urlMatch) {
        return {
            runId: urlMatch[1] ?? null,
            runUrl: urlMatch[0] ?? null,
        };
    }
    // Fall back to extracting just the run ID
    const idMatch = normalized.match(RUN_ID_PATTERN);
    return {
        runId: idMatch?.[1] ?? null,
        runUrl: null,
    };
}
//# sourceMappingURL=workflow-dispatch-receipt.js.map