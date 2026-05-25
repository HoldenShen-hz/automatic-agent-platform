import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";

export interface ChineseWallAccessStep {
  readonly stepId: string;
  readonly action: "prepare_grant" | "commit_grant" | "prepare_release" | "commit_release" | "audit";
  readonly succeeded: boolean;
  readonly phase?: "prepare" | "commit" | "compensate" | "audit";
}

export interface ChineseWallAccessSagaHandlerContext {
  readonly accessId: string;
  readonly failedAction: ChineseWallAccessStep["action"] | null;
}

export interface ChineseWallAccessSagaHandlers {
  readonly prepareGrant?: (step: ChineseWallAccessStep, context: ChineseWallAccessSagaHandlerContext) => void;
  readonly commitGrant?: (step: ChineseWallAccessStep, context: ChineseWallAccessSagaHandlerContext) => void;
  readonly prepareRelease?: (step: ChineseWallAccessStep, context: ChineseWallAccessSagaHandlerContext) => void;
  readonly commitRelease?: (step: ChineseWallAccessStep, context: ChineseWallAccessSagaHandlerContext) => void;
  readonly compensateGrant?: (step: ChineseWallAccessStep, context: ChineseWallAccessSagaHandlerContext) => void;
  readonly compensateRelease?: (step: ChineseWallAccessStep, context: ChineseWallAccessSagaHandlerContext) => void;
  readonly audit?: (step: ChineseWallAccessStep, context: ChineseWallAccessSagaHandlerContext) => void;
}

export interface ChineseWallAccessSagaReceipt {
  readonly accessId: string;
  readonly status: "committed" | "rolled_back";
  readonly committedActions: readonly ChineseWallAccessStep["action"][];
  readonly rollbackRequired: boolean;
  readonly compensatedActions: readonly ChineseWallAccessStep["action"][];
  readonly failedAction: ChineseWallAccessStep["action"] | null;
  readonly executionLog: readonly {
    readonly stepId: string;
    readonly action: ChineseWallAccessStep["action"];
    readonly outcome: "prepared" | "committed" | "compensated" | "audited" | "failed";
  }[];
}

const chineseWallAccessSagaLogger = new StructuredLogger({ retentionLimit: 100 });

export class ChineseWallAccessSaga {
  public constructor(private readonly handlers: ChineseWallAccessSagaHandlers = {}) {}

  public execute(accessId: string, steps: readonly ChineseWallAccessStep[]): ChineseWallAccessSagaReceipt {
    const orderedSteps = [...steps].sort(compareSagaSteps);
    const auditSteps = orderedSteps.filter((step) => step.action === "audit");
    const workflowSteps = orderedSteps.filter((step) => step.action !== "audit");
    const preparedSteps: ChineseWallAccessStep[] = [];
    const committedSteps: ChineseWallAccessStep[] = [];
    const preparedStepIds = new Set<string>();
    const committedActions: ChineseWallAccessStep["action"][] = [];
    const compensatedActions: ChineseWallAccessStep["action"][] = [];
    const executionLog: Array<ChineseWallAccessSagaReceipt["executionLog"][number]> = [];
    let failedAction: ChineseWallAccessStep["action"] | null = null;
    const context = (): ChineseWallAccessSagaHandlerContext => ({ accessId, failedAction });

    for (const step of workflowSteps) {
      const normalizedStep = withPhase(step);
      try {
        switch (normalizedStep.action) {
          case "prepare_grant":
          case "prepare_release":
            this.runAction(normalizedStep, context());
            if (!normalizedStep.succeeded) {
              failedAction = normalizedStep.action;
              executionLog.push({
                stepId: normalizedStep.stepId,
                action: normalizedStep.action,
                outcome: "failed",
              });
              throw new Error(`saga.prepare_failed:${normalizedStep.action}`);
            }
            preparedSteps.push(normalizedStep);
            preparedStepIds.add(normalizedStep.stepId);
            executionLog.push({
              stepId: normalizedStep.stepId,
              action: normalizedStep.action,
              outcome: "prepared",
            });
            break;
          case "commit_grant":
          case "commit_release":
            if (!hasMatchingPrepareStep(preparedStepIds, normalizedStep)) {
              failedAction = normalizedStep.action;
              executionLog.push({
                stepId: normalizedStep.stepId,
                action: normalizedStep.action,
                outcome: "failed",
              });
              throw new Error(`saga.missing_prepare:${normalizedStep.action}`);
            }
            this.runAction(normalizedStep, context());
            if (!normalizedStep.succeeded) {
              failedAction = normalizedStep.action;
              executionLog.push({
                stepId: normalizedStep.stepId,
                action: normalizedStep.action,
                outcome: "failed",
              });
              throw new Error(`saga.commit_failed:${normalizedStep.action}`);
            }
            committedSteps.push(normalizedStep);
            committedActions.push(normalizedStep.action);
            executionLog.push({
              stepId: normalizedStep.stepId,
              action: normalizedStep.action,
              outcome: "committed",
            });
            break;
          case "audit":
            break;
        }
      } catch (error) {
        chineseWallAccessSagaLogger.warn("chinese_wall_access_saga.step_failed", {
          accessId,
          stepId: normalizedStep.stepId,
          action: normalizedStep.action,
          error: error instanceof Error ? error.message : String(error),
        });
        failedAction ??= normalizedStep.action;
        const lastLog = executionLog[executionLog.length - 1];
        if (
          lastLog?.stepId !== normalizedStep.stepId
          || lastLog.action !== normalizedStep.action
          || lastLog.outcome !== "failed"
        ) {
          executionLog.push({
            stepId: normalizedStep.stepId,
            action: normalizedStep.action,
            outcome: "failed",
          });
        }
        break;
      }
    }

    const failed = failedAction != null;

    if (failed) {
      for (const step of [...committedSteps, ...preparedSteps].reverse()) {
        const syntheticStep: ChineseWallAccessStep = {
          stepId: `${accessId}:compensate:${step.stepId}`,
          action: step.action,
          succeeded: true,
          phase: "compensate",
        };
        this.runCompensation(syntheticStep, context());
        compensatedActions.push(step.action);
        executionLog.push({
          stepId: syntheticStep.stepId,
          action: syntheticStep.action,
          outcome: "compensated",
        });
      }
    }

    for (const step of auditSteps) {
      const auditStep = withPhase(step);
      this.handlers.audit?.(auditStep, context());
      executionLog.push({
        stepId: auditStep.stepId,
        action: auditStep.action,
        outcome: "audited",
      });
    }

    return {
      accessId,
      status: failed ? "rolled_back" : "committed",
      committedActions: failed ? [] : committedActions,
      rollbackRequired: failed,
      compensatedActions,
      failedAction,
      executionLog,
    };
  }

  private runAction(step: ChineseWallAccessStep, context: ChineseWallAccessSagaHandlerContext): void {
    switch (step.action) {
      case "prepare_grant":
        this.handlers.prepareGrant?.(step, context);
        return;
      case "commit_grant":
        this.handlers.commitGrant?.(step, context);
        return;
      case "prepare_release":
        this.handlers.prepareRelease?.(step, context);
        return;
      case "commit_release":
        this.handlers.commitRelease?.(step, context);
        return;
      case "audit":
        this.handlers.audit?.(step, context);
        return;
    }
  }

  private runCompensation(step: ChineseWallAccessStep, context: ChineseWallAccessSagaHandlerContext): void {
    switch (step.action) {
      case "prepare_grant":
      case "commit_grant":
        this.handlers.compensateGrant?.(step, context);
        return;
      case "prepare_release":
      case "commit_release":
        this.handlers.compensateRelease?.(step, context);
        return;
      case "audit":
        return;
    }
  }
}

function compareSagaSteps(left: ChineseWallAccessStep, right: ChineseWallAccessStep): number {
  const order: Record<ChineseWallAccessStep["action"], number> = {
    prepare_grant: 0,
    prepare_release: 1,
    commit_grant: 2,
    commit_release: 3,
    audit: 4,
  };
  return order[left.action] - order[right.action] || left.stepId.localeCompare(right.stepId);
}

function withPhase(step: ChineseWallAccessStep): ChineseWallAccessStep {
  if (step.phase != null) {
    return step;
  }
  if (step.action === "prepare_grant" || step.action === "prepare_release") {
    return { ...step, phase: "prepare" };
  }
  if (step.action === "commit_grant" || step.action === "commit_release") {
    return { ...step, phase: "commit" };
  }
  return { ...step, phase: "audit" };
}

function hasMatchingPrepareStep(preparedStepIds: ReadonlySet<string>, step: ChineseWallAccessStep): boolean {
  for (const candidate of derivePrepareStepCandidates(step.stepId)) {
    if (preparedStepIds.has(candidate)) {
      return true;
    }
  }
  return false;
}

function derivePrepareStepCandidates(stepId: string): string[] {
  const candidates = new Set<string>([stepId]);
  if (stepId.startsWith("commit_")) {
    candidates.add(`prepare_${stepId.slice("commit_".length)}`);
  }
  if (stepId.includes("commit")) {
    candidates.add(stepId.replace(/commit/g, "prepare"));
  }
  return [...candidates];
}
