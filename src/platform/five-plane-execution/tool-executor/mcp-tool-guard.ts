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
import { listBuiltinToolExecutionMetadata } from "./tool-metadata.js";
import { sanitizeStructuredOutput, sanitizeToolOutput } from "./tool-output-sanitizer.js";
import type { ToolCallErrorSource, ToolCallStatus } from "./tool-call-result.js";

const MCP_TOOL_PREFIX = "mcp_";

/**
 * Pattern that matches forbidden output schemas in MCP responses.
 * Blocks responses containing function_call, tool_use, or tool_calls fields
 * which could be used for nested tool invocations or prompt injection.
 */
const FORBIDDEN_MCP_OUTPUT_PATTERN = /"(?:function_call|tool_use|tool_calls)"\s*:/i;
const FORBIDDEN_MCP_OUTPUT_FIELDS = new Set(["function_call", "tool_use", "tool_calls"]);

/**
 * Set of builtin tool names for collision detection.
 * Built from the tool metadata registry at module load time.
 */
const BUILTIN_TOOL_NAMES = new Set(listBuiltinToolExecutionMetadata().map((metadata) => metadata.toolName));

/**
 * Issue found during MCP tool validation.
 */
export interface McpToolValidationIssue {
  code:
    | "namespace_invalid"
    | "builtin_collision"
    | "metadata_missing"
    | "metadata_name_mismatch"
    | "provider_dependency_invalid"
    | "approval_mode_invalid"
    | "side_effect_scope_invalid";
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

function containsForbiddenStructuredPayload(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => containsForbiddenStructuredPayload(entry));
  }
  if (value == null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Object.entries(record).some(([key, entry]) => {
    if (FORBIDDEN_MCP_OUTPUT_FIELDS.has(key)) {
      return true;
    }
    return containsForbiddenStructuredPayload(entry);
  });
}

/**
 * Parses an MCP tool name into its components.
 *
 * MCP tool names follow the format: mcp_<server>_<tool>
 * Examples: mcp_filesystem_read, mcp_github_create_issue
 *
 * @param toolName - The tool name to parse
 * @returns Server name and remote tool name, or null if format is invalid
 */
function parseMcpToolName(toolName: string): { serverName: string; remoteToolName: string } | null {
  if (!toolName.startsWith(MCP_TOOL_PREFIX)) {
    return null;
  }

  const parts = toolName.split("_");
  if (parts.length < 3) {
    return null;
  }

  const serverName = parts[1]?.trim() ?? "";
  const remoteToolName = parts.slice(2).join("_").trim();
  if (serverName.length === 0 || remoteToolName.length === 0) {
    return null;
  }

  // Validate format: only lowercase letters, numbers, and underscores
  const allowedPattern = /^[a-z0-9_]+$/;
  if (!allowedPattern.test(serverName) || !allowedPattern.test(remoteToolName)) {
    return null;
  }

  return {
    serverName,
    remoteToolName,
  };
}

/**
 * Checks if a tool name follows the MCP naming convention.
 * MCP tools must use the namespaced form mcp_<server>_<tool>.
 */
export function isMcpToolName(toolName: string): boolean {
  return parseMcpToolName(toolName) != null;
}

/**
 * Validates the definition-time properties of an MCP tool name.
 * Called during tool registration to catch issues early.
 *
 * @param toolName - The MCP tool name to validate
 * @returns Validation issue if found, null if valid
 */
export function validateMcpToolDefinition(toolName: string): McpToolValidationIssue | null {
  if (toolName === "mcp") {
    return {
      code: "namespace_invalid",
      detail: `MCP tool ${toolName} must use the namespaced form mcp_<server>_<tool>.`,
    };
  }
  if (!isMcpToolName(toolName)) {
    return null;
  }

  const parsed = parseMcpToolName(toolName);
  if (!parsed) {
    return {
      code: "namespace_invalid",
      detail: `MCP tool ${toolName} must use the namespaced form mcp_<server>_<tool>.`,
    };
  }

  // Check for collision with builtin tools
  if (BUILTIN_TOOL_NAMES.has(toolName) || BUILTIN_TOOL_NAMES.has(parsed.remoteToolName)) {
    return {
      code: "builtin_collision",
      detail: `MCP tool ${toolName} collides with builtin tool.`,
    };
  }

  return null;
}

/**
 * Validates the runtime properties of an MCP tool.
 * Called before execution to verify the tool is properly configured.
 *
 * @param toolName - The MCP tool name being executed
 * @param metadata - The tool's registered metadata
 * @returns Validation issue if found, null if valid
 */
export function validateMcpToolRuntime(
  toolName: string,
  metadata: ToolExecutionMetadata | null,
): McpToolValidationIssue | null {
  const definitionIssue = validateMcpToolDefinition(toolName);
  if (definitionIssue) {
    return definitionIssue;
  }

  if (!isMcpToolName(toolName)) {
    return null;
  }

  // Tool must be explicitly registered before use
  if (metadata == null) {
    return {
      code: "metadata_missing",
      detail: `MCP tool ${toolName} must be explicitly registered before execution.`,
    };
  }

  // Metadata name must match the resolved tool name
  if (metadata.toolName !== toolName) {
    return {
      code: "metadata_name_mismatch",
      detail: `MCP tool metadata must match the resolved tool name ${toolName}.`,
    };
  }

  // MCP tools must declare external provider dependency
  if (metadata.providerDependency !== "required") {
    return {
      code: "provider_dependency_invalid",
      detail: `MCP tool ${toolName} must declare providerDependency=required.`,
    };
  }

  // MCP tools must declare external side effect scope
  if (
    metadata.sideEffectScope !== "remote_api"
    && metadata.sideEffectScope !== "billing"
    && metadata.sideEffectScope !== "org_state"
  ) {
    return {
      code: "side_effect_scope_invalid",
      detail: `MCP tool ${toolName} must declare an external sideEffectScope.`,
    };
  }

  // Mutable MCP tools cannot bypass approval
  if (!metadata.readOnly && metadata.approvalMode === "never") {
    return {
      code: "approval_mode_invalid",
      detail: `Mutable MCP tool ${toolName} cannot bypass approval with approvalMode=never.`,
    };
  }

  return null;
}

/**
 * Sanitizes the result of an MCP tool call to prevent injection attacks.
 * Removes forbidden schemas and redacts sensitive content from output.
 *
 * @param toolName - The MCP tool name that produced the result
 * @param result - The raw result from the tool
 * @returns Sanitized result safe for agent consumption
 */
export function sanitizeMcpToolCallResult(toolName: string, result: McpGuardedToolCallResult): McpGuardedToolCallResult {
  if (!isMcpToolName(toolName)) {
    return result;
  }

  // Sanitize all text output fields
  const sanitizedSummary = result.summary == null ? null : sanitizeToolOutput(result.summary).sanitizedText;
  const sanitizedOutput = result.output == null ? null : sanitizeToolOutput(result.output).sanitizedText;
  const sanitizedStructured =
    result.data == null
      ? null
      : sanitizeStructuredOutput(result.data);
  const sanitizedData = sanitizedStructured?.sanitizedValue ?? null;

  // Check for forbidden payload patterns in any output field
  const forbiddenPayloads = containsForbiddenStructuredPayload(sanitizedData)
    || [sanitizedSummary, sanitizedOutput]
    .filter((value): value is string => value != null)
    .some((value) => FORBIDDEN_MCP_OUTPUT_PATTERN.test(value));

  // Block results containing forbidden tool-call schemas
  if (forbiddenPayloads) {
    return {
      ...result,
      success: false,
      status: "blocked",
      summary: `MCP tool ${toolName} returned blocked tool-call payload content.`,
      data: null,
      errorCode: "tool.mcp_output_schema_blocked",
      errorSource: "security",
      retryable: false,
    };
  }

  // Return sanitized result preserving original structure
  return {
    ...result,
    ...(sanitizedSummary == null ? {} : { summary: sanitizedSummary }),
    ...(sanitizedOutput == null ? {} : { output: sanitizedOutput }),
    ...(sanitizedStructured == null ? {} : { data: sanitizedData }),
  };
}
