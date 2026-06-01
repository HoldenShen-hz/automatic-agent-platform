/**
 * Runbook Executor
 *
 * Executes runbook steps in sequence and records results.
 * Supports pausing for confirmation, retry, and abort.
 *
 * ## Execution Flow
 *
 * 1. Initialize execution with runbook and context
 * 2. For each section:
 *    a. For each step:
 *       - Check if confirmation required
 *       - Execute step (or pause for confirmation)
 *       - Record result
 *       - Handle failure according to config
 * 3. Return execution result
 */

import { spawn } from "node:child_process";

import { newId, nowIso } from "../incident-platform-support.js";
import type {
  ParsedRunbook,
  RunbookExecutionResult,
  RunbookExecutionStatus,
  RunbookSectionExecutionResult,
  RunbookStepResult,
  RunbookStepStatus,
  RunbookExecutorConfig,
  RunbookExecutionContext,
  RunbookStep,
} from "./types.js";
import { parseRunbookMarkdown } from "./markdown-parser.js";

const READ_ONLY_KUBECTL_SUBCOMMANDS = new Set(["get", "describe", "logs", "top", "api-resources", "api-versions", "cluster-info", "config", "version"]);
const READ_ONLY_DOCKER_SUBCOMMANDS = new Set(["ps", "images", "inspect", "logs", "events", "stats", "version", "info"]);
const COMMAND_LIKE_EXECUTABLES = new Set([
  "cat",
  "curl",
  "df",
  "docker",
  "echo",
  "free",
  "git",
  "grep",
  "kubectl",
  "ls",
  "ps",
  "pwd",
  "top",
]);

function isReadOnlyDiagnosticCommand(command: string): boolean {
  const trimmed = command.trim();
  if (trimmed.length === 0) {
    return false;
  }

  const parts = trimmed.split(/\s+/);
  const executable = parts[0]?.toLowerCase();
  const subcommand = parts[1]?.toLowerCase();

  if (executable == null) {
    return false;
  }

  if (["curl", "git", "ls", "cat", "grep", "echo", "pwd", "ps", "top", "free", "df"].includes(executable)) {
    return true;
  }

  if (executable === "kubectl") {
    return subcommand != null && READ_ONLY_KUBECTL_SUBCOMMANDS.has(subcommand);
  }

  if (executable === "docker") {
    return subcommand != null && READ_ONLY_DOCKER_SUBCOMMANDS.has(subcommand);
  }

  return false;
}

function isCommandLike(command: string): boolean {
  const trimmed = command.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const executable = trimmed.split(/\s+/u, 1)[0]?.toLowerCase();
  if (executable == null) {
    return false;
  }
  return executable.startsWith("./")
    || executable.startsWith("/")
    || COMMAND_LIKE_EXECUTABLES.has(executable);
}

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (quote != null) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }
    if (/\s/u.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (escaping || quote != null) {
    throw new Error("runbook.command_parse_failed");
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

/**
 * Result of a single step execution.
 */
export interface StepExecutionOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runbook Executor Service
 *
 * Executes markdown runbooks with support for:
 * - Manual and automatic execution modes
 * - Step confirmation pauses
 * - Configurable failure handling
 * - Execution state persistence
 */
export class RunbookExecutor {
  private readonly config: RunbookExecutorConfig;
  private currentExecution: RunbookExecutionResult | null = null;
  private readonly commandRunner: (command: string, timeoutMs: number) => Promise<StepExecutionOutput>;

  public constructor(config: Partial<RunbookExecutorConfig> = {}) {
    this.config = {
      autoExecute: config.autoExecute ?? false,
      stepTimeoutMs: config.stepTimeoutMs ?? 300_000,
      continueOnFailure: config.continueOnFailure ?? false,
      executeVerification: config.executeVerification ?? true,
      ...(config.commandRunner != null ? { commandRunner: config.commandRunner } : {}),
    };
    this.commandRunner = config.commandRunner ?? executeReadOnlyCommand;
  }

  /**
   * Parses a markdown runbook without executing it.
   */
  public parse(markdown: string, runbookId?: string): ParsedRunbook {
    return parseRunbookMarkdown(markdown, runbookId);
  }

  /**
   * Initializes a new runbook execution.
   */
  public initializeExecution(
    runbook: ParsedRunbook,
    executedBy: string,
    context?: RunbookExecutionContext,
  ): RunbookExecutionResult {
    const executionId = newId("runbook_exec");
    const startedAt = nowIso();

    const sectionResults: RunbookSectionExecutionResult[] = runbook.sections
      .filter((section) => section.isExecutable)
      .map((section) => ({
        sectionName: section.name,
        status: "initialized" as RunbookExecutionStatus,
        stepResults: section.steps.map((step) => this.createStepResult(step, startedAt)),
        completedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
      }));

    this.currentExecution = {
      executionId,
      runbook,
      status: "initialized",
      sectionResults,
      outcome: "failed",
      summary: "Execution not started",
      startedAt,
      completedAt: null,
      totalDurationMs: null,
      executedBy,
    };

    return this.currentExecution;
  }

  /**
   * Gets the current execution state.
   */
  public getCurrentExecution(): RunbookExecutionResult | null {
    return this.currentExecution;
  }

  /**
   * Gets steps that are waiting for confirmation.
   */
  public getPendingConfirmations(): RunbookStepResult[] {
    if (!this.currentExecution) {
      return [];
    }

    const pending: RunbookStepResult[] = [];
    for (const section of this.currentExecution.sectionResults) {
      for (const step of section.stepResults) {
        if (step.status === "requires_confirmation") {
          pending.push(step);
        }
      }
    }
    return pending;
  }

  /**
   * Confirms a pending step to proceed with execution.
   */
  public confirmStep(executionId: string, stepIndex: number): RunbookStepResult | null {
    if (!this.currentExecution || this.currentExecution.executionId !== executionId) {
      return null;
    }

    for (const section of this.currentExecution.sectionResults) {
      if (stepIndex < section.stepResults.length) {
        const step = section.stepResults[stepIndex]!;
        if (step.status === "requires_confirmation") {
          step.status = "running";
          step.startedAt = nowIso();
          return step;
        }
      }
    }
    return null;
  }

  /**
   * Executes a step and returns the result.
   */
  public async executeStep(
    executionId: string,
    sectionName: string,
    stepIndex: number,
    simulatedResult?: { success: boolean; output?: string },
  ): Promise<RunbookStepResult | null> {
    if (!this.currentExecution || this.currentExecution.executionId !== executionId) {
      return null;
    }

    const section = this.currentExecution.sectionResults.find(
      (s) => s.sectionName === sectionName,
    );
    if (!section || stepIndex >= section.stepResults.length) {
      return null;
    }

    const stepResult = section.stepResults[stepIndex]!;
    const step = stepResult.step;

    // Check if step requires confirmation and we're in manual mode
    if (step.requiresConfirmation && !this.config.autoExecute) {
      stepResult.status = "requires_confirmation";
      stepResult.waitingForConfirmation = true;
      stepResult.startedAt = nowIso();
      return stepResult;
    }

    // Execute the step
    stepResult.status = "running";
    stepResult.startedAt = nowIso();

    try {
      const result = await this.executeStepCommand(step.command, simulatedResult);

      stepResult.status = result.success ? "completed" : "failed";
      stepResult.output = result.output ?? "";
      if (!result.success) {
        stepResult.errorMessage = result.output ?? "Step execution failed";
      }
      stepResult.completedAt = nowIso();
      stepResult.durationMs = new Date(stepResult.completedAt).getTime() - new Date(stepResult.startedAt).getTime();
    } catch (error) {
      stepResult.status = "failed";
      stepResult.errorMessage = error instanceof Error ? error.message : String(error);
      stepResult.completedAt = nowIso();
      stepResult.durationMs = new Date(stepResult.completedAt).getTime() - new Date(stepResult.startedAt).getTime();
    }

    // Update section stats
    this.updateSectionStats(section);

    // Check if execution is complete
    this.checkExecutionComplete();

    return stepResult;
  }

  private async executeStepCommand(
    command: string,
    simulatedResult?: { success: boolean; output?: string },
  ): Promise<{ success: boolean; output?: string }> {
    if (simulatedResult) {
      return simulatedResult;
    }

    if (isReadOnlyDiagnosticCommand(command)) {
      const result = await this.commandRunner(command, this.config.stepTimeoutMs);
      const output = [result.stdout.trim(), result.stderr.trim()].filter((value) => value.length > 0).join("\n");
      return {
        success: result.exitCode === 0,
        output: output.length > 0 ? output : `[OK] Command exited with code ${result.exitCode}`,
      };
    }

    if (isCommandLike(command)) {
      return {
        success: false,
        output: `[Blocked] Non-read-only command requires operator approval or an explicit simulated result: ${command}`,
      };
    }

    return {
      success: true,
      output: `[Recorded] Step acknowledged without shell execution: ${command}`,
    };
  }

  /**
   * Updates section statistics after step completion.
   */
  private updateSectionStats(section: RunbookSectionExecutionResult): void {
    section.completedSteps = section.stepResults.filter((s) => s.status === "completed").length;
    section.failedSteps = section.stepResults.filter((s) => s.status === "failed").length;
    section.skippedSteps = section.stepResults.filter((s) => s.status === "skipped").length;

    // Update section status
    if (section.stepResults.every((s) => s.status === "completed")) {
      section.status = "completed";
    } else if (section.stepResults.some((s) => s.status === "failed")) {
      section.status = "failed";
    } else if (section.stepResults.some((s) => s.status === "running" || s.status === "requires_confirmation")) {
      section.status = "running";
    }
  }

  /**
   * Checks if the entire execution is complete and updates outcome.
   */
  private checkExecutionComplete(): void {
    if (!this.currentExecution) {
      return;
    }

    const allSections = this.currentExecution.sectionResults;
    const anyFailed = allSections.some((s) => s.status === "failed");
    const allCompleted = allSections.every((s) => s.status === "completed");
    const anyRunning = allSections.some((s) => s.status === "running");

    if (anyRunning) {
      this.currentExecution.status = "running";
      return;
    }

    if (allCompleted) {
      this.currentExecution.status = "completed";
      this.currentExecution.completedAt = nowIso();
      this.currentExecution.totalDurationMs =
        new Date(this.currentExecution.completedAt).getTime() -
        new Date(this.currentExecution.startedAt).getTime();
      this.currentExecution.outcome = "success";
      this.currentExecution.summary = `Runbook "${this.currentExecution.runbook.title}" executed successfully`;
    } else if (anyFailed) {
      this.currentExecution.status = "failed";
      this.currentExecution.completedAt = nowIso();
      this.currentExecution.totalDurationMs =
        new Date(this.currentExecution.completedAt).getTime() -
        new Date(this.currentExecution.startedAt).getTime();
      this.currentExecution.outcome = this.config.continueOnFailure ? "partial" : "failed";
      this.currentExecution.summary = `Runbook "${this.currentExecution.runbook.title}" failed with errors`;
    }
  }

  /**
   * Skips a step without executing it.
   */
  public skipStep(executionId: string, sectionName: string, stepIndex: number): RunbookStepResult | null {
    if (!this.currentExecution || this.currentExecution.executionId !== executionId) {
      return null;
    }

    const section = this.currentExecution.sectionResults.find(
      (s) => s.sectionName === sectionName,
    );
    if (!section || stepIndex >= section.stepResults.length) {
      return null;
    }

    const stepResult = section.stepResults[stepIndex]!;
    stepResult.status = "skipped";
    stepResult.completedAt = nowIso();

    this.updateSectionStats(section);
    this.checkExecutionComplete();

    return stepResult;
  }

  /**
   * Aborts the current execution.
   */
  public abort(executionId: string): RunbookExecutionResult | null {
    if (!this.currentExecution || this.currentExecution.executionId !== executionId) {
      return null;
    }

    this.currentExecution.status = "aborted";
    this.currentExecution.completedAt = nowIso();
    this.currentExecution.totalDurationMs =
      new Date(this.currentExecution.completedAt).getTime() -
      new Date(this.currentExecution.startedAt).getTime();
    this.currentExecution.outcome = "aborted";
    this.currentExecution.summary = `Runbook "${this.currentExecution.runbook.title}" was aborted`;

    return this.currentExecution;
  }

  /**
   * Creates a step result with initial state.
   */
  private createStepResult(step: RunbookStep, baseTime: string): RunbookStepResult {
    return {
      step,
      status: "pending",
      command: step.command,
      output: "",
      startedAt: baseTime,
      completedAt: baseTime,
      durationMs: 0,
    };
  }

  /**
   * Generates a markdown report of the execution.
   */
  public generateExecutionReport(execution: RunbookExecutionResult): string {
    const lines = [
      `# Runbook Execution Report`,
      ``,
      `- Execution ID: \`${execution.executionId}\``,
      `- Runbook: ${execution.runbook.title}`,
      `- Severity: ${execution.runbook.severity}`,
      `- Status: ${execution.status}`,
      `- Outcome: ${execution.outcome}`,
      `- Executed By: ${execution.executedBy}`,
      `- Started At: ${execution.startedAt}`,
      execution.completedAt ? `- Completed At: ${execution.completedAt}` : null,
      execution.totalDurationMs ? `- Duration: ${execution.totalDurationMs}ms` : null,
      ``,
      `## Summary`,
      ``,
      execution.summary,
      ``,
      `## Section Results`,
      ``,
    ];

    for (const section of execution.sectionResults) {
      lines.push(`### ${section.sectionName}`);
      lines.push(`- Status: ${section.status}`);
      lines.push(`- Completed: ${section.completedSteps}/${section.stepResults.length}`);
      if (section.failedSteps > 0) {
        lines.push(`- Failed: ${section.failedSteps}`);
      }
      lines.push(``);

      for (const step of section.stepResults) {
        const icon = step.status === "completed" ? "✅" : step.status === "failed" ? "❌" : step.status === "skipped" ? "⏭️" : step.status === "requires_confirmation" ? "⏸️" : "⬜";
        lines.push(`${icon} ${step.step.stepNumber}. ${step.command}`);
        if (step.output) {
          lines.push(`   ${step.output.split("\n").join("\n   ")}`);
        }
        if (step.errorMessage) {
          lines.push(`   ERROR: ${step.errorMessage}`);
        }
        lines.push(``);
      }
    }

    return lines.filter((l) => l !== null).join("\n");
  }
}

async function executeReadOnlyCommand(command: string, timeoutMs: number): Promise<StepExecutionOutput> {
  const tokens = tokenizeCommand(command);
  if (tokens.length === 0) {
    throw new Error("runbook.command_parse_failed");
  }

  return new Promise<StepExecutionOutput>((resolve, reject) => {
    const child = spawn(tokens[0]!, tokens.slice(1), {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("runbook.command_timeout"));
    }, timeoutMs);
    timeout.unref?.();

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (exitCode) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
      });
    });
  });
}
