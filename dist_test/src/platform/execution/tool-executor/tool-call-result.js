/**
 * Tool Call Result Types
 *
 * Defines the core type system for tool execution results, including:
 * - Status codes (succeeded, failed, timed_out, blocked, cancelled)
 * - Error classification (provider, tool, network, security, validation, system)
 * - Structured result interface with metadata, artifacts, and execution receipts
 */
/**
 * Convenience function to check if a tool call status represents success.
 * Returns true only for "succeeded" status.
 */
export function isToolCallSuccessful(status) {
    return status === "succeeded";
}
//# sourceMappingURL=tool-call-result.js.map