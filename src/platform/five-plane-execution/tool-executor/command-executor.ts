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

import { type ChildProcess } from "node:child_process";
import { join, resolve } from "node:path";

import { ArtifactStore } from "../../five-plane-state-evidence/artifacts/artifact-store.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const commandExecutorLogger = new StructuredLogger({ retentionLimit: 100 });
import { checkSandboxPath } from "../../five-plane-control-plane/iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { sanitizeToolOutput, type SanitizedToolOutput } from "./tool-output-sanitizer.js";
import { assessCommand } from "./command-security.js";
import { isToolCallSuccessful, type ToolCallResult } from "./tool-call-result.js";
import {
  coerceCommandToolRequest,
  formatToolArgumentCoercionWarnings,
  type ToolArgumentCoercionTrace,
} from "./tool-argument-coercion.js";
import {
  isExecutionToolAllowed,
  resolveExecutionAllowedPathRoots,
  resolveExecutionAllowedTools,
} from "./tool-execution-access.js";
import { checkToolPathScope } from "./tool-path-scope.js";
import { resolveToolExecutionMetadata, resolveToolTimeoutMs, type CommandToolRequest } from "./tool-metadata.js";
import { getProcessTracker, spawnTracked, type ProcessTracker } from "../resource/process-tracker.js";
import { globalEffectBuffer, EffectBuilder } from "../execution-engine/effect-buffer.js";

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
export interface CommandExecutionResult extends ToolCallResult<
  SanitizedToolOutput,
  CommandExecutionData,
  CommandExecutionMetadata
> {
}

export interface CommandExecutorOptions {
  persistedMessageLimitChars?: number;
  artifactRootDirName?: string;
  store?: AuthoritativeTaskStore;
  maxCapturedOutputBytes?: number;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Terminates a process and all its child processes recursively.
 * Uses SIGTERM first for graceful shutdown, then escalates to SIGKILL if needed.
 * Uses negative PID on Unix systems to kill the entire process group.
 *
 * @param child - The child process to terminate
 * @param forceKillAfterDelayMs - Ms to wait before escalating to SIGKILL (default: 5000)
 */
function killProcessTree(child: ChildProcess, forceKillAfterDelayMs: number = 5000): void {
  const pid = child.pid;
  if (pid == null) {
    return;
  }

  const killSignal = process.platform !== "win32" ? "SIGTERM" : "SIGTERM";
  const killPgid = process.platform !== "win32";

  try {
    if (killPgid) {
      // First try SIGTERM for graceful shutdown of entire process group
      process.kill(-pid, killSignal);

      // Schedule SIGKILL as fallback after grace period
      setTimeout(() => {
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          // Process may have already exited
        }
      }, forceKillAfterDelayMs).unref();
    } else {
      child.kill(killSignal);
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // Process may have already exited
        }
      }, forceKillAfterDelayMs).unref();
    }
  } catch (err) {
    commandExecutorLogger.warn("command_executor: process kill failed, forcing SIGKILL", { error: err instanceof Error ? err.message : String(err) });
    // Fallback to SIGKILL immediately
    try {
      if (killPgid) {
        process.kill(-pid, "SIGKILL");
      } else {
        child.kill("SIGKILL");
      }
    } catch {
      // Process may have already exited
    }
  }
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
export class CommandExecutor {
  private readonly persistedMessageLimitChars: number;
  private readonly artifactRootDirName: string;
  private readonly store: AuthoritativeTaskStore | null;
  private readonly processTracker: ProcessTracker;
  private readonly maxCapturedOutputBytes: number;

  // Process concurrency limiter to prevent fork bomb / resource exhaustion
  private static readonly MAX_CONCURRENT_PROCESSES = 16;
  private static activeProcessCount = 0;

  public constructor(options: CommandExecutorOptions = {}) {
    this.persistedMessageLimitChars = Math.max(256, Math.trunc(options.persistedMessageLimitChars ?? 6000));
    this.artifactRootDirName = options.artifactRootDirName?.trim() || ".aa-tool-artifacts";
    this.store = options.store ?? null;
    this.processTracker = getProcessTracker();
    this.maxCapturedOutputBytes = Math.max(4096, Math.trunc(options.maxCapturedOutputBytes ?? 1_048_576));
  }

  /**
   * Executes a system command with sandbox enforcement and security validation.
   *
   * @param request - Command execution request containing command, args, cwd, and sandbox policy
   * @param signal - Optional AbortSignal for cancellation support
   * @returns Promise resolving to CommandExecutionResult with status, output, and metadata
   */
  public async execute(request: CommandToolRequest, signal?: AbortSignal): Promise<CommandExecutionResult> {
    // TOOL-01: atomic check-and-reserve. Previously the check and the
    // increment were separated by dozens of async operations, so many
    // callers could observe activeProcessCount < MAX simultaneously and all
    // pass the guard — producing a spawn storm that defeated the limit. We
    // now reserve the slot synchronously before any await and release it via
    // `slotReleased` on every exit path.
    if (CommandExecutor.activeProcessCount >= CommandExecutor.MAX_CONCURRENT_PROCESSES) {
      const coercedRequestResult = coerceCommandToolRequest(request);
      return this.blocked(coercedRequestResult.value, "tool.process_limit_exceeded", coercedRequestResult.traces);
    }
    CommandExecutor.activeProcessCount++;
    let slotReleased = false;
    const releaseSlot = (): void => {
      if (slotReleased) return;
      slotReleased = true;
      CommandExecutor.activeProcessCount = Math.max(0, CommandExecutor.activeProcessCount - 1);
    };

    try {
    const coercedRequestResult = coerceCommandToolRequest(request);
    const normalizedRequest = coercedRequestResult.value;
    const coercionWarnings = formatToolArgumentCoercionWarnings(coercedRequestResult.traces);

    const metadata = resolveToolExecutionMetadata(normalizedRequest.toolName);
    if (
      normalizedRequest.timeoutMs != null &&
      (
        typeof normalizedRequest.timeoutMs !== "number" ||
        !Number.isFinite(normalizedRequest.timeoutMs) ||
        normalizedRequest.timeoutMs <= 0 ||
        normalizedRequest.timeoutMs > 600_000
      )
    ) {
      return this.blocked(normalizedRequest, "tool.timeout_invalid", coercedRequestResult.traces);
    }
    if (
      normalizedRequest.sandboxPolicy.mode !== "read_only" &&
      normalizedRequest.sandboxPolicy.mode !== "workspace_write" &&
      normalizedRequest.sandboxPolicy.mode !== "scoped_external_access" &&
      normalizedRequest.sandboxPolicy.mode !== "restricted_exec"
    ) {
      return this.blocked(normalizedRequest, "tool.sandbox_policy_invalid", coercedRequestResult.traces);
    }
    const timeoutMs = resolveToolTimeoutMs(normalizedRequest.timeoutMs, metadata);
    if (!isStringArray(normalizedRequest.args)) {
      return this.blocked(normalizedRequest, "tool.command_args_invalid", coercedRequestResult.traces);
    }
    if (
      (normalizedRequest.allowedPathRoots !== undefined && !isStringArray(normalizedRequest.allowedPathRoots))
      || (normalizedRequest.declaredReadPaths !== undefined && !isStringArray(normalizedRequest.declaredReadPaths))
      || (normalizedRequest.declaredWritePaths !== undefined && !isStringArray(normalizedRequest.declaredWritePaths))
    ) {
      return this.blocked(normalizedRequest, "tool.command_path_arguments_invalid", coercedRequestResult.traces);
    }
    const execution = normalizedRequest.executionId == null ? null : this.store?.getExecution(normalizedRequest.executionId) ?? null;
    const allowedToolsResolution = resolveExecutionAllowedTools({
      execution,
      executionRequired: normalizedRequest.executionId != null,
    });
    if (allowedToolsResolution.errorCode != null) {
      return this.blocked(normalizedRequest, allowedToolsResolution.errorCode, coercedRequestResult.traces);
    }
    if (!isExecutionToolAllowed(normalizedRequest.toolName, allowedToolsResolution.allowedTools)) {
      return this.blocked(normalizedRequest, "tool.tool_not_allowed", coercedRequestResult.traces);
    }
    const allowedPathRootsResolution = resolveExecutionAllowedPathRoots({
      execution,
      executionRequired: normalizedRequest.executionId != null,
      requestAllowedPathRoots: normalizedRequest.allowedPathRoots,
    });
    if (allowedPathRootsResolution.errorCode != null) {
      return this.blocked(normalizedRequest, allowedPathRootsResolution.errorCode, coercedRequestResult.traces);
    }
    const allowedPathRoots = allowedPathRootsResolution.allowedPathRoots;

    // Step 1: Validate command against security policy (blocks dangerous commands, pipes, etc.)
    const commandAssessment = assessCommand(normalizedRequest.command, normalizedRequest.args);
    if (!commandAssessment.allowed) {
      return this.blocked(normalizedRequest, commandAssessment.reasonCode ?? "tool.command_denied", coercedRequestResult.traces);
    }

    // Step 2: Validate working directory access
    const cwdCheck = checkSandboxPath(normalizedRequest.sandboxPolicy, normalizedRequest.cwd);
    if (!cwdCheck.allowed) {
      return this.blocked(normalizedRequest, "sandbox.cwd_denied", coercedRequestResult.traces);
    }
    const cwdScopeCheck = checkToolPathScope(cwdCheck.normalizedPath, allowedPathRoots);
    if (!cwdScopeCheck.allowed) {
      return this.blocked(normalizedRequest, "tool.path_scope_cwd_denied", coercedRequestResult.traces);
    }

    // Step 3: Validate all declared read paths
    for (const path of normalizedRequest.declaredReadPaths ?? []) {
      const check = checkSandboxPath(normalizedRequest.sandboxPolicy, path);
      if (!check.allowed) {
        return this.blocked(normalizedRequest, "sandbox.read_path_denied", coercedRequestResult.traces);
      }
      const scopeCheck = checkToolPathScope(check.normalizedPath, allowedPathRoots);
      if (!scopeCheck.allowed) {
        return this.blocked(normalizedRequest, "tool.path_scope_read_denied", coercedRequestResult.traces);
      }
    }

    // Step 4: Validate all declared write paths
    for (const path of normalizedRequest.declaredWritePaths ?? []) {
      const check = checkSandboxPath(normalizedRequest.sandboxPolicy, path);
      if (!check.allowed) {
        return this.blocked(normalizedRequest, "sandbox.write_path_denied", coercedRequestResult.traces);
      }
      const scopeCheck = checkToolPathScope(check.normalizedPath, allowedPathRoots);
      if (!scopeCheck.allowed) {
        return this.blocked(normalizedRequest, "tool.path_scope_write_denied", coercedRequestResult.traces);
      }
    }

    for (const pathArg of commandAssessment.sandboxWriteArgPaths) {
      if (pathArg.includes("\x00")) {
        return this.blocked(normalizedRequest, "sandbox.command_arg_path_denied", coercedRequestResult.traces);
      }

      if (normalizedRequest.sandboxPolicy.mode === "read_only") {
        return this.blocked(normalizedRequest, "sandbox.write_path_denied", coercedRequestResult.traces);
      }

      const resolvedPathArg = resolve(cwdCheck.normalizedPath, pathArg);
      const check = checkSandboxPath(normalizedRequest.sandboxPolicy, resolvedPathArg);
      if (!check.allowed) {
        return this.blocked(normalizedRequest, "sandbox.write_path_denied", coercedRequestResult.traces);
      }
      const scopeCheck = checkToolPathScope(check.normalizedPath, allowedPathRoots);
      if (!scopeCheck.allowed) {
        return this.blocked(normalizedRequest, "tool.path_scope_write_denied", coercedRequestResult.traces);
      }
    }

    for (const pathArg of commandAssessment.sandboxReadArgPaths) {
      // S-07: Reject null-byte injection in path arguments before any processing.
      // Node.js's spawn validates this, but we catch it earlier to return a consistent blocked status.
      if (pathArg.includes("\x00")) {
        return this.blocked(normalizedRequest, "sandbox.command_arg_path_denied", coercedRequestResult.traces);
      }

      const resolvedPathArg = resolve(cwdCheck.normalizedPath, pathArg);
      const check = checkSandboxPath(normalizedRequest.sandboxPolicy, resolvedPathArg);
      if (!check.allowed) {
        return this.blocked(normalizedRequest, "sandbox.command_arg_path_denied", coercedRequestResult.traces);
      }
      const scopeCheck = checkToolPathScope(check.normalizedPath, allowedPathRoots);
      if (!scopeCheck.allowed) {
        return this.blocked(normalizedRequest, "tool.path_scope_command_arg_denied", coercedRequestResult.traces);
      }
    }

    const startedAt = Date.now();
    let timedOut = false;
    let cancelled = false;

    // Step 5: Spawn the child process
    // - detached: true creates a new process group on Unix (for proper cleanup)
    // - stdio: ['ignore', 'pipe', 'pipe'] connects stdin to /dev/null, captures stdout/stderr
    // TOOL-01: slot is already reserved at entry; do not increment again here.
    const child = spawnTracked(this.processTracker, normalizedRequest.command, [...normalizedRequest.args], {
      cwd: cwdCheck.normalizedPath,
      detached: process.platform !== "win32",
    }, "bash-tool");

    // Abort handler for cancellation support
    const abortHandler = () => {
      cancelled = true;
      killProcessTree(child);
    };

    signal?.addEventListener("abort", abortHandler, { once: true });

    // Timeout handler - R-01: add unref() to not block graceful shutdown
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, timeoutMs);
    timer.unref();

    // Step 6: Use EffectScope for guaranteed cleanup with compensation
    const scopeId = `cmd:${normalizedRequest.callId}`;
    const scope = globalEffectBuffer.createScope({
      scopeId,
      defaultTimeoutMs: timeoutMs * 2,
    });

    let stdout = "";
    let stderr = "";
    let capturedOutputBytes = 0;
    let outputLimitExceeded = false;
    let exitCode: number | null = null;

    const effect = EffectBuilder.create("callback_invoke", `spawn:${normalizedRequest.command}`)
      .withExecute(async () => {
        return new Promise<void>((resolve, reject) => {
          child.stdout?.on("data", (chunk: Buffer) => {
            capturedOutputBytes += chunk.byteLength;
            if (capturedOutputBytes > this.maxCapturedOutputBytes) {
              outputLimitExceeded = true;
              killProcessTree(child);
              return;
            }
            stdout += chunk.toString("utf8");
          });
          child.stderr?.on("data", (chunk: Buffer) => {
            capturedOutputBytes += chunk.byteLength;
            if (capturedOutputBytes > this.maxCapturedOutputBytes) {
              outputLimitExceeded = true;
              killProcessTree(child);
              return;
            }
            stderr += chunk.toString("utf8");
          });
          child.on("error", reject);
          child.on("close", (code: number | null) => {
            exitCode = code;
            resolve();
          });
        });
      })
      .withCompensate(async () => {
        killProcessTree(child);
      })
      .withTimeout(timeoutMs)
      .build();

    scope.addEffect(effect);
    scope.commit();

    try {
      // Execute effects and wait for spawn to complete
      await scope.executeEffects();

      // Step 7: Sanitize output to remove secrets and control characters
      const combinedOutput = [stdout, stderr].filter(Boolean).join("\n");
      const fullOutput = sanitizeToolOutput(combinedOutput, {
        persistedMessageLimitChars: Number.MAX_SAFE_INTEGER,
      });
      let output = sanitizeToolOutput(combinedOutput, {
        persistedMessageLimitChars: this.persistedMessageLimitChars,
      });
      let artifacts: string[] = [];

      if (fullOutput.sanitizedText.length > this.persistedMessageLimitChars) {
        try {
          const artifactStore = new ArtifactStore({
            rootDir: join(resolve(normalizedRequest.cwd), this.artifactRootDirName),
            sandboxPolicy: normalizedRequest.sandboxPolicy,
          });
          const artifact = artifactStore.writeTextArtifact({
            taskId: normalizedRequest.taskId,
            stepId: normalizedRequest.callId,
            kind: "tool_output",
            fileName: `${normalizedRequest.callId}-${normalizedRequest.command}.log`,
            content: fullOutput.sanitizedText,
            lineage: {
              toolName: normalizedRequest.toolName,
              command: normalizedRequest.command,
              args: normalizedRequest.args,
              traceId: normalizedRequest.traceId,
            },
          });
          artifacts = [artifact.ref.uri];
          output = {
            ...output,
            rawRef: artifact.ref.uri,
            warnings: output.warnings.includes("output_externalized")
              ? output.warnings
              : [...output.warnings, "output_externalized"],
          };
        } catch (err) {
          commandExecutorLogger.warn("command_executor: failed to externalize output", { error: err instanceof Error ? err.message : String(err), callId: normalizedRequest.callId });
          output = {
            ...output,
            warnings: output.warnings.includes("output_externalize_failed")
              ? output.warnings
              : [...output.warnings, "output_externalize_failed"],
          };
        }
      }
      const durationMs = Date.now() - startedAt;

      // Step 8: Handle various terminal conditions
      if (cancelled) {
        return this.buildResult(normalizedRequest, "cancelled", output, artifacts, durationMs, {
          code: "tool.cancelled",
          message: "Command execution was cancelled",
          retryable: false,
          source: "tool",
        }, `cancelled:${normalizedRequest.callId}`, coercedRequestResult.traces);
      }

      if (timedOut) {
        return this.buildResult(normalizedRequest, "timed_out", output, artifacts, durationMs, {
          code: "tool.timeout",
          message: "Command execution timed out",
          retryable: true,
          source: "tool",
        }, `timeout:${normalizedRequest.callId}`, coercedRequestResult.traces);
      }

      if (outputLimitExceeded) {
        return this.buildResult(normalizedRequest, "failed", output, artifacts, durationMs, {
          code: "tool.output_limit_exceeded",
          message: `Command output exceeded ${this.maxCapturedOutputBytes} bytes`,
          retryable: false,
          source: "tool",
        }, `output_limit:${normalizedRequest.callId}`, coercedRequestResult.traces);
      }

      if (exitCode !== 0) {
        return this.buildResult(normalizedRequest, "failed", output, artifacts, durationMs, {
          code: "tool.command_failed",
          message: `Command exited with code ${exitCode}`,
          retryable: false,
          source: "tool",
        }, `exit:${normalizedRequest.callId}:${exitCode}`, coercedRequestResult.traces);
      }

      // Success case
      if (coercionWarnings.length > 0) {
        output = {
          ...output,
          warnings: [...output.warnings, ...coercionWarnings],
        };
      }
      return this.buildResult(normalizedRequest, "succeeded", output, artifacts, durationMs, null, `ok:${normalizedRequest.callId}`, coercedRequestResult.traces);
    } finally {
      // Cleanup: remove listeners, clear timeout, release process slot
      releaseSlot();
      clearTimeout(timer);
      signal?.removeEventListener("abort", abortHandler);
    }
    } finally {
      // TOOL-01: belt-and-suspenders release in case a pre-spawn early
      // return (e.g. sandbox denial) short-circuited past the inner finally.
      releaseSlot();
    }
  }

  /**
   * Creates a blocked result when security policy denies command execution.
   *
   * @param request - Original execution request
   * @param reasonCode - Machine-readable reason for the block
   * @returns CommandExecutionResult with blocked status
   */
  private blocked(request: CommandToolRequest, reasonCode: string, coercions: readonly ToolArgumentCoercionTrace[] = []): CommandExecutionResult {
    const warnings = formatToolArgumentCoercionWarnings(coercions);
    return this.buildResult(
      request,
      "blocked",
      sanitizeToolOutput("Command blocked by sandbox or command policy.", {
        persistedMessageLimitChars: this.persistedMessageLimitChars,
      }),
      [],
      0,
      {
        code: reasonCode,
        message: reasonCode,
        retryable: false,
        source: "security",
      },
      null,
      coercions,
      warnings,
    );
  }

  private buildResult(
    request: CommandToolRequest,
    status: CommandExecutionResult["status"],
    output: SanitizedToolOutput,
    artifacts: readonly string[],
    durationMs: number,
    error: CommandExecutionResult["error"],
    executionReceipt: string | null,
    coercions: readonly ToolArgumentCoercionTrace[] = [],
    extraWarnings: readonly string[] = [],
  ): CommandExecutionResult {
    const warnings = [...new Set([...output.warnings, ...extraWarnings, ...formatToolArgumentCoercionWarnings(coercions)])];
    return {
      callId: request.callId,
      toolName: request.toolName,
      status,
      success: isToolCallSuccessful(status),
      output,
      data: {
        rawRef: output.rawRef,
        truncated: output.truncated,
        redactionCount: output.redactionCount,
        controlCharsRemoved: output.controlCharsRemoved,
        ansiRemoved: output.ansiRemoved,
        injectionRisk: output.injectionRisk,
        matchedInjectionRules: [...output.matchedInjectionRules],
      },
      metadata: {
        command: request.command,
        args: [...request.args],
        cwd: request.cwd,
        warnings,
        coercions: [...coercions],
        artifactCount: artifacts.length,
      },
      artifacts,
      durationMs,
      error,
      executionReceipt,
    };
  }
}
