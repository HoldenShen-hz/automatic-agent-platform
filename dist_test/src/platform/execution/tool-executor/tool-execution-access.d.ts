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
 * Resolves the list of tools that an execution is allowed to invoke.
 *
 * Priority order:
 * 1. Request-level allowlist (if provided)
 * 2. Execution-level allowlist from database (if execution is required)
 * 3. No restrictions (returns undefined)
 */
export declare function resolveExecutionAllowedTools(options: {
    execution: Pick<ExecutionRecord, "allowedToolsJson"> | null;
    executionRequired: boolean;
    requestAllowedTools?: readonly string[] | null | undefined;
}): ExecutionAllowedToolsResolution;
/**
 * Checks if a specific tool is allowed based on the resolved allowlist.
 *
 * @param toolName - The tool to check
 * @param allowedTools - The allowlist to check against (undefined means all allowed)
 * @returns true if the tool is allowed
 */
export declare function isExecutionToolAllowed(toolName: string, allowedTools: readonly string[] | undefined): boolean;
/**
 * Resolves the allowed path roots for an execution's tool invocations.
 *
 * Path roots restrict where tools can read/write files.
 * Similar priority order as tool allowlist resolution.
 */
export declare function resolveExecutionAllowedPathRoots(options: {
    execution: Pick<ExecutionRecord, "allowedPathsJson"> | null;
    executionRequired: boolean;
    requestAllowedPathRoots?: readonly string[] | null | undefined;
}): ExecutionAllowedPathRootsResolution;
