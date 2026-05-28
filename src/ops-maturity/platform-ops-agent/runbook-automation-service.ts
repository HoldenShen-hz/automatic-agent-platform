import { newId, nowIso } from "../../platform/contracts/types/ids.js";

export interface AutomatedRunbook {
  readonly runbookId: string;
  readonly name: string;
  readonly steps: readonly string[];
}

export interface RunbookStepResult {
  readonly stepId: string;
  readonly stepName: string;
  readonly status: "success" | "failed" | "skipped";
  readonly output?: string;
  readonly error?: string;
  readonly durationMs: number;
}

export interface AutomatedRunbookExecution {
  readonly executionId: string;
  readonly runbookId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly completedSteps: readonly string[];
  readonly stepResults: readonly RunbookStepResult[];
  readonly status: "running" | "completed" | "failed";
  readonly totalDurationMs: number;
}

export interface RunbookExecutionContext {
  readonly environment: "production" | "staging" | "development";
  readonly actorId: string;
  readonly dryRun: boolean;
}

function getDeterministicDuration(stepIndex: number): number {
  return 50 + stepIndex * 25;
}

function shouldFailStep(stepName: string): boolean {
  return /(^|[-_])(fail|error|abort)([-_]|$)/i.test(stepName);
}

function executeStep(stepName: string, stepIndex: number, isDryRun: boolean): RunbookStepResult {
  const simulatedDelay = getDeterministicDuration(stepIndex);

  if (isDryRun) {
    return {
      stepId: `step_${stepIndex}`,
      stepName,
      status: "skipped",
      output: `[DRY RUN] Would execute: ${stepName}`,
      durationMs: simulatedDelay,
    };
  }

  if (!shouldFailStep(stepName)) {
    return {
      stepId: `step_${stepIndex}`,
      stepName,
      status: "success",
      output: `Successfully executed: ${stepName}`,
      durationMs: simulatedDelay,
    };
  }

  return {
    stepId: `step_${stepIndex}`,
    stepName,
    status: "failed",
    error: `Step failed: ${stepName} - deterministic guard failure`,
    durationMs: simulatedDelay,
  };
}

export class RunbookAutomationService {
  private readonly executionHistory = new Map<string, AutomatedRunbookExecution>();
  private readonly maxHistoryEntries = 100;

  public execute(
    runbook: AutomatedRunbook,
    context?: Partial<RunbookExecutionContext>,
  ): AutomatedRunbookExecution {
    const executionId = newId("ops_runbook_exec");
    const startedAt = nowIso();
    const isDryRun = context?.dryRun ?? false;

    const stepResults: RunbookStepResult[] = [];
    const completedSteps: string[] = [];

    for (let i = 0; i < runbook.steps.length; i++) {
      const stepName = runbook.steps[i]!;
      const result = executeStep(stepName, i, isDryRun);
      stepResults.push(result);

      if (result.status === "success" || result.status === "skipped") {
        completedSteps.push(stepName);
      } else {
        break;
      }
    }

    const completedAt = nowIso();
    const allSucceeded = stepResults.every((r) => r.status === "success" || r.status === "skipped");
    const status: AutomatedRunbookExecution["status"] = allSucceeded ? "completed" : "failed";

    const totalDurationMs = stepResults.reduce((sum, r) => sum + r.durationMs, 0);

    const execution: AutomatedRunbookExecution = {
      executionId,
      runbookId: runbook.runbookId,
      startedAt,
      completedAt,
      completedSteps,
      stepResults,
      status,
      totalDurationMs,
    };

    this.executionHistory.set(executionId, execution);
    this.evictOldEntries();

    return execution;
  }

  public getExecution(executionId: string): AutomatedRunbookExecution | null {
    return this.executionHistory.get(executionId) ?? null;
  }

  public listExecutions(runbookId?: string, limit = 10): AutomatedRunbookExecution[] {
    const all = [...this.executionHistory.values()];
    const filtered = runbookId ? all.filter((e) => e.runbookId === runbookId) : all;
    return filtered.slice(-limit).reverse();
  }

  public getStatistics(): {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    averageDurationMs: number;
  } {
    const all = [...this.executionHistory.values()];
    if (all.length === 0) {
      return { totalExecutions: 0, successCount: 0, failureCount: 0, averageDurationMs: 0 };
    }

    const successCount = all.filter((e) => e.status === "completed").length;
    const failureCount = all.filter((e) => e.status === "failed").length;
    const totalDurationMs = all.reduce((sum, e) => sum + e.totalDurationMs, 0);

    return {
      totalExecutions: all.length,
      successCount,
      failureCount,
      averageDurationMs: Math.round(totalDurationMs / all.length),
    };
  }

  private evictOldEntries(): void {
    if (this.executionHistory.size <= this.maxHistoryEntries) return;

    const entries = [...this.executionHistory.entries()];
    const toRemove = entries.slice(0, entries.length - this.maxHistoryEntries);
    for (const [key] of toRemove) {
      this.executionHistory.delete(key);
    }
  }
}
