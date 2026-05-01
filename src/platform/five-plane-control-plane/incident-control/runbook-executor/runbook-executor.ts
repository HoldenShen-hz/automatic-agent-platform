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

import { newId, nowIso } from "../../../../platform/contracts/types/ids.js";
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

  public constructor(config: Partial<RunbookExecutorConfig> = {}) {
    this.config = {
      autoExecute: config.autoExecute ?? false,
      stepTimeoutMs: config.stepTimeoutMs ?? 300_000,
      continueOnFailure: config.continueOnFailure ?? false,
      executeVerification: config.executeVerification ?? true,
    };
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
   *
   * In a real implementation, this would execute actual commands.
   * Here we simulate execution for testing purposes.
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
      // Simulate command execution
      // In a real implementation, this would spawn a child process
      const result = await this.simulateStepExecution(step.command, simulatedResult);

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

  /**
   * Simulates step execution for testing.
   * In production, this would actually execute commands.
   */
  private async simulateStepExecution(
    command: string,
    simulatedResult?: { success: boolean; output?: string },
  ): Promise<{ success: boolean; output?: string }> {
    // Simulate async execution delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    if (simulatedResult) {
      return simulatedResult;
    }

    // Default: assume success for diagnostic/read-only commands
    // §181-2130: Removed curl/kubectl/docker/git from read-only patterns - these can
    // perform destructive operations (curl can download malicious scripts, kubectl/docker
    // can modify cluster/container state, git can commit/push changes). Only truly
    // diagnostic commands that cannot modify state should be marked as read-only.
    const readOnlyPatterns = [
      /^(ls|cat|grep|echo|pwd|ps|top|free|df)/i,
    ];
    const isReadOnly = readOnlyPatterns.some((pattern) => pattern.test(command));

    return {
      success: true,
      output: isReadOnly
        ? `[Simulated] Executed: ${command}\n[OK] Command completed successfully`
        : `[Simulated] Executed: ${command}\n[OK] Action completed`,
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
