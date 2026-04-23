/**
 * Command Executor
 *
 * This module provides the CommandExecutor class responsible for safely executing
 * external system commands within a sandboxed environment. It handles security policy
 * validation, path access control, process lifecycle management, and output sanitization.
 *
 * The executor enforces a multi-layer security model:
 * 1. Command-level assessment (via command-security.ts)
 * 2. Sandbox path validation (via sandbox-policy.ts)
 * 3. Output sanitization (via tool-output-sanitizer.ts)
 *
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/contracts/sandbox_contract.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/contracts/policy_engine_contract.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/governance/glossary_and_terminology.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/architecture/00-platform-architecture.md}
 */
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { type SanitizedToolOutput } from "./tool-output-sanitizer.js";
import { type ToolCallResult } from "./tool-call-result.js";
import { type ToolArgumentCoercionTrace } from "./tool-argument-coercion.js";
import { type CommandToolRequest } from "./tool-metadata.js";
export interface CommandExecutionData {
    rawRef: string | null;
    truncated: boolean;
    redactionCount: number;
    controlCharsRemoved: number;
    ansiRemoved: boolean;
    injectionRisk: SanitizedToolOutput["injectionRisk"];
    matchedInjectionRules: readonly string[];
}
export interface CommandExecutionMetadata {
    command: string;
    args: readonly string[];
    cwd: string;
    warnings: readonly string[];
    coercions: readonly ToolArgumentCoercionTrace[];
    artifactCount: number;
}
/**
 * Result of a command execution attempt, containing status, output, and diagnostics.
 */
export interface CommandExecutionResult extends ToolCallResult<SanitizedToolOutput, CommandExecutionData, CommandExecutionMetadata> {
}
export interface CommandExecutorOptions {
    persistedMessageLimitChars?: number;
    artifactRootDirName?: string;
    store?: AuthoritativeTaskStore;
}
/**
 * CommandExecutor safely executes external system commands within a sandboxed environment.
 *
 * It validates commands against security policies, enforces path access restrictions,
 * manages process lifecycle (including timeouts and cancellation), and sanitizes output
 * to prevent information leakage.
 *
 * The execution flow:
 * 1. Assess command safety via command-security module
 * 2. Validate working directory and declared paths against sandbox policy
 * 3. Spawn the process with appropriate stdio configuration
 * 4. Handle timeout and cancellation via AbortSignal
 * 5. Collect and sanitize stdout/stderr output
 * 6. Return structured result with execution metadata
 */
export declare class CommandExecutor {
    private readonly persistedMessageLimitChars;
    private readonly artifactRootDirName;
    private readonly store;
    private readonly processTracker;
    private static readonly MAX_CONCURRENT_PROCESSES;
    private static activeProcessCount;
    constructor(options?: CommandExecutorOptions);
    /**
     * Executes a system command with sandbox enforcement and security validation.
     *
     * @param request - Command execution request containing command, args, cwd, and sandbox policy
     * @param signal - Optional AbortSignal for cancellation support
     * @returns Promise resolving to CommandExecutionResult with status, output, and metadata
     */
    execute(request: CommandToolRequest, signal?: AbortSignal): Promise<CommandExecutionResult>;
    /**
     * Creates a blocked result when security policy denies command execution.
     *
     * @param request - Original execution request
     * @param reasonCode - Machine-readable reason for the block
     * @returns CommandExecutionResult with blocked status
     */
    private blocked;
    private buildResult;
}
