/**
 * Tool Execution Access Control
 *
 * Resolves whether a tool is allowed to execute based on:
 * - Execution-level tool allowlists (from execution.allowedToolsJson)
 * - Request-level tool allowlists (from the API request)
 * - Whether an execution context is required
 *
 * This module handles the logic for determining which tools an execution
 * is permitted to invoke, supporting both explicit allowlists and
 * the case where no restrictions apply.
 */

import type { ExecutionRecord } from "../../contracts/types/domain.js";
import { normalizeToolPathScopeRoots } from "./tool-path-scope.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const toolExecutionAccessLogger = new StructuredLogger({ retentionLimit: 100 });

// Fail-closed default when execution context is required: allowedTools: []

/**
 * Result of parsing the stored tool allowlist from the database.
 */
interface StoredStringArrayParseResult {
  status: "missing" | "resolved" | "invalid";
  values: string[] | undefined;
}

/**
 * Resolution result for allowed tools determination.
 */
export interface ExecutionAllowedToolsResolution {
  /** The resolved list of allowed tool names, or undefined if no restrictions */
  allowedTools: string[] | undefined;

  /** Error code if resolution failed */
  errorCode: string | null;
}

/**
 * Resolution result for allowed path roots determination.
 */
export interface ExecutionAllowedPathRootsResolution {
  /** The resolved list of allowed path roots, or undefined if no restrictions */
  allowedPathRoots: string[] | undefined;

  /** Error code if resolution failed */
  errorCode: string | null;
}

/**
 * Normalizes an array of tool names or paths by trimming, deduplicating,
 * and removing empty values.
 */
function normalizeStringAllowlist(values: readonly string[]): string[] {
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(normalized)];
}

/**
 * Parses a stored JSON string that should contain an array of strings.
 * Used for reading allowedToolsJson and allowedPathsJson from execution records.
 */
function parseStoredStringArray(raw: string | null): StoredStringArrayParseResult {
  if (raw == null) {
    return {
      status: "missing",
      values: undefined,
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return {
        status: "invalid",
        values: undefined,
      };
    }

    // Validate all elements are non-empty strings
    if (parsed.some((item) => typeof item !== "string" || item.trim().length === 0)) {
      return {
        status: "invalid",
        values: undefined,
      };
    }

    return {
      status: "resolved",
      values: normalizeStringAllowlist(parsed),
    };
  } catch (err) {
    toolExecutionAccessLogger.warn("tool_execution_access: JSON.parse failed in parseStoredStringArray", { error: err instanceof Error ? err.message : String(err), raw: raw != null ? raw.substring(0, 100) : null });
    return {
      status: "invalid",
      values: undefined,
    };
  }
}

/**
 * Resolves the list of tools that an execution is allowed to invoke.
 *
 * Priority order:
 * 1. Request-level allowlist (if provided)
 * 2. Execution-level allowlist from database (if execution is required)
 * 3. No restrictions (returns undefined)
 */
export function resolveExecutionAllowedTools(options: {
  execution: Pick<ExecutionRecord, "allowedToolsJson"> | null;
  executionRequired: boolean;
  requestAllowedTools?: readonly string[] | null | undefined;
}): ExecutionAllowedToolsResolution {
  // Priority 1: Request-level allowlist
  if (options.requestAllowedTools != null) {
    return {
      allowedTools: normalizeStringAllowlist(options.requestAllowedTools),
      errorCode: null,
    };
  }

  // No restrictions if execution context is not required
  if (!options.executionRequired) {
    return {
      allowedTools: undefined,
      errorCode: null,
    };
  }

  // Execution required but no execution provided
  if (options.execution == null) {
    // R32-03 fix: Return empty allowlist (no tools allowed) when execution is required but missing.
    // Previously returned allowedTools:undefined which callers may interpret as "no restrictions".
    return {
      allowedTools: [],
      errorCode: "tool.execution_missing",
    };
  }

  // Priority 2: Execution-level allowlist from database
  const parsed = parseStoredStringArray(options.execution.allowedToolsJson);
  if (parsed.status === "invalid") {
    return {
      allowedTools: undefined,
      errorCode: "tool.execution_allowed_tools_invalid",
    };
  }

  return {
    allowedTools: parsed.values,
    errorCode: null,
  };
}

/**
 * Checks if a specific tool is allowed based on the resolved allowlist.
 *
 * @param toolName - The tool to check
 * @param allowedTools - The allowlist to check against (undefined means all allowed)
 * @returns true if the tool is allowed
 */
export function isExecutionToolAllowed(toolName: string, allowedTools: readonly string[] | undefined): boolean {
  // undefined allowlist means no restrictions
  return allowedTools == null || allowedTools.includes(toolName);
}

/**
 * Resolves the allowed path roots for an execution's tool invocations.
 *
 * Path roots restrict where tools can read/write files.
 * Similar priority order as tool allowlist resolution.
 */
export function resolveExecutionAllowedPathRoots(options: {
  execution: Pick<ExecutionRecord, "allowedPathsJson"> | null;
  executionRequired: boolean;
  requestAllowedPathRoots?: readonly string[] | null | undefined;
}): ExecutionAllowedPathRootsResolution {
  // Priority 1: Request-level path roots
  if (options.requestAllowedPathRoots != null) {
    const normalized = normalizeToolPathScopeRoots(options.requestAllowedPathRoots);
    return {
      allowedPathRoots: normalized.length === 0 ? undefined : normalized,
      errorCode: null,
    };
  }

  // No restrictions if execution context is not required
  if (!options.executionRequired) {
    return {
      allowedPathRoots: undefined,
      errorCode: null,
    };
  }

  // Execution required but no execution provided
  if (options.execution == null) {
    return {
      allowedPathRoots: undefined,
      errorCode: "tool.execution_missing",
    };
  }

  // Priority 2: Execution-level path roots from database
  const parsed = parseStoredStringArray(options.execution.allowedPathsJson);
  if (parsed.status === "invalid") {
    return {
      allowedPathRoots: undefined,
      errorCode: "tool.execution_allowed_paths_invalid",
    };
  }

  const normalized = normalizeToolPathScopeRoots(parsed.values);
  return {
    allowedPathRoots: normalized.length === 0 ? undefined : normalized,
    errorCode: null,
  };
}
