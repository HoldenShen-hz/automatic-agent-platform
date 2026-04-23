/**
 * MCP Tool Guard
 *
 * Provides security validation and output sanitization for MCP (Model Context Protocol) tools.
 * MCP tools are external tools accessed via a namespaced naming convention (mcp_<server>_<tool>).
 *
 * Security concerns addressed:
 * - Namespace format validation to prevent injection
 * - Collision detection with builtin tools
 * - Runtime metadata validation for external tools
 * - Output sanitization to block forbidden response schemas
 */
import type { ToolExecutionMetadata } from "./tool-metadata.js";
import type { ToolCallErrorSource, ToolCallStatus } from "./tool-call-result.js";
/**
 * Issue found during MCP tool validation.
 */
export interface McpToolValidationIssue {
    code: "namespace_invalid" | "builtin_collision" | "metadata_missing" | "metadata_name_mismatch" | "provider_dependency_invalid" | "approval_mode_invalid" | "side_effect_scope_invalid";
    detail: string;
}
/**
 * Result of an MCP tool call after guard processing.
 * Contains sanitized output and any security-relevant transformations.
 */
export interface McpGuardedToolCallResult {
    success: boolean;
    status?: ToolCallStatus;
    summary?: string;
    output?: string;
    data?: Record<string, unknown> | null;
    errorCode?: string | null;
    errorSource?: ToolCallErrorSource | null;
    retryable?: boolean;
    durationMs?: number;
}
/**
 * Checks if a tool name follows the MCP naming convention.
 * Returns true for "mcp" or names starting with "mcp_".
 */
export declare function isMcpToolName(toolName: string): boolean;
/**
 * Validates the definition-time properties of an MCP tool name.
 * Called during tool registration to catch issues early.
 *
 * @param toolName - The MCP tool name to validate
 * @returns Validation issue if found, null if valid
 */
export declare function validateMcpToolDefinition(toolName: string): McpToolValidationIssue | null;
/**
 * Validates the runtime properties of an MCP tool.
 * Called before execution to verify the tool is properly configured.
 *
 * @param toolName - The MCP tool name being executed
 * @param metadata - The tool's registered metadata
 * @returns Validation issue if found, null if valid
 */
export declare function validateMcpToolRuntime(toolName: string, metadata: ToolExecutionMetadata | null): McpToolValidationIssue | null;
/**
 * Sanitizes the result of an MCP tool call to prevent injection attacks.
 * Removes forbidden schemas and redacts sensitive content from output.
 *
 * @param toolName - The MCP tool name that produced the result
 * @param result - The raw result from the tool
 * @returns Sanitized result safe for agent consumption
 */
export declare function sanitizeMcpToolCallResult(toolName: string, result: McpGuardedToolCallResult): McpGuardedToolCallResult;
