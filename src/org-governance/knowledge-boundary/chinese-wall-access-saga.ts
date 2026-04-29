export type ChineseWallAccessPhase = "prepare" | "commit" | "compensate" | "audit";

export interface ChineseWallAccessStep {
  readonly stepId: string;
  readonly action: "prepare_grant" | "commit_grant" | "prepare_release" | "commit_release" | "audit";
  readonly succeeded: boolean;
  readonly phase?: ChineseWallAccessPhase;
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

const PHASE_ORDER: ChineseWallAccessPhase[] = ["prepare", "commit", "compensate", "audit"];

function sortStepsByPhase(steps: readonly ChineseWallAccessStep[]): ChineseWallAccessStep[] {
  return [...steps].sort((left, right) => {
    const leftPhase = left.phase ?? inferPhase(left.action);
    const rightPhase = right.phase ?? inferPhase(right.action);
    const leftIdx = PHASE_ORDER.indexOf(leftPhase);
    const rightIdx = PHASE_ORDER.indexOf(rightPhase);
    if (leftIdx !== rightIdx) {
      return leftIdx - rightIdx;
    }
    return left.stepId.localeCompare(right.stepId);
  });
}

function inferPhase(action: ChineseWallAccessStep["action"]): ChineseWallAccessPhase {
  switch (action) {
    case "prepare_grant":
    case "prepare_release":
      return "prepare";
    case "commit_grant":
    case "commit_release":
      return "commit";
    case "audit":
      return "audit";
  }
}

export class ChineseWallAccessSaga {
  public constructor(private readonly handlers: ChineseWallAccessSagaHandlers = {}) {}

  public execute(accessId: string, steps: readonly ChineseWallAccessStep[]): ChineseWallAccessSagaReceipt {
    const sortedSteps = sortStepsByPhase(steps);
    const preparedActions: ChineseWallAccessStep["action"][] = [];
    const committedActions: ChineseWallAccessStep["action"][] = [];
    const compensatedActions: ChineseWallAccessStep["action"][] = [];
    const executionLog: Array<ChineseWallAccessSagaReceipt["executionLog"][number]> = [];
    let failedAction: ChineseWallAccessStep["action"] | null = null;
    const context = (): ChineseWallAccessSagaHandlerContext => ({ accessId, failedAction });

    // Phase: prepare
    for (const step of sortedSteps.filter((candidate) => candidate.action === "prepare_grant" || candidate.action === "prepare_release")) {
      try {
        this.runAction(step, context());
        preparedActions.push(step.action);
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          outcome: "prepared",
        });
      } catch {
        failedAction = step.action;
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          outcome: "failed",
        });
        break;
      }
    }

    // Phase: commit
    if (failedAction == null) {
      const preparedSet = new Set(preparedActions);
      for (const step of sortedSteps.filter((candidate) => candidate.action === "commit_grant" || candidate.action === "commit_release")) {
        if (!hasMatchingPrepareStep(preparedSet, step.stepId)) {
          failedAction = step.action;
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            outcome: "failed",
          });
          break;
        }
        if (!step.succeeded) {
          failedAction = step.action;
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            outcome: "failed",
          });
          break;
        }
        try {
          this.runAction(step, context());
          committedActions.push(step.action);
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            outcome: "committed",
          });
        } catch {
          failedAction = step.action;
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            outcome: "failed",
          });
          break;
        }
      }
    }

    // Phase: compensate (on failure)
    if (failedAction != null) {
      const allActionsToCompensate = [...committedActions, ...preparedActions].reverse();
      for (const action of allActionsToCompensate) {
        const compensationAction = invertActionForCompensation(action);
        const syntheticStep: ChineseWallAccessStep = {
          stepId: `${accessId}:${compensationAction}`,
          action: compensationAction,
          succeeded: true,
        };
        try {
          this.runCompensation(syntheticStep, context());
          compensatedActions.push(action);
          executionLog.push({
            stepId: syntheticStep.stepId,
            action: syntheticStep.action,
            outcome: "compensated",
          });
        } catch {
          executionLog.push({
            stepId: syntheticStep.stepId,
            action: syntheticStep.action,
            outcome: "failed",
          });
        }
      }
    }

    // Phase: audit
    for (const step of sortedSteps.filter((candidate) => candidate.action === "audit")) {
      this.runAction(step, context());
      executionLog.push({
        stepId: step.stepId,
        action: step.action,
        outcome: "audited",
      });
    }

    const hasCompensation = compensatedActions.length > 0;
    return {
      accessId,
      status: failedAction != null ? "rolled_back" : "committed",
      committedActions: failedAction != null ? [] : committedActions,
      rollbackRequired: failedAction != null,
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
      case "prepare_release":
        this.handlers.compensateGrant?.(step, context);
        return;
      case "commit_release":
        this.handlers.compensateRelease?.(step, context);
        return;
      case "prepare_grant":
        this.handlers.compensateRelease?.(step, context);
        return;
      case "commit_grant":
        this.handlers.compensateGrant?.(step, context);
        return;
      case "audit":
        this.handlers.audit?.(step, context);
        return;
    }
  }
}

function hasMatchingPrepareStep(preparedSet: ReadonlySet<string>, commitStepId: string): boolean {
  for (const candidate of derivePrepareStepCandidates(commitStepId)) {
    if (preparedSet.has(candidate)) {
      return true;
    }
  }
  return false;
}

function derivePrepareStepCandidates(commitStepId: string): readonly string[] {
  const candidates = new Set<string>([commitStepId]);
  if (commitStepId.includes("commit")) {
    candidates.add(commitStepId.replace("commit", "prepare"));
  }
  if (commitStepId.startsWith("commit_")) {
    candidates.add(`prepare_${commitStepId.slice("commit_".length)}`);
  }
  return [...candidates];
}

function invertActionForCompensation(
  action: ChineseWallAccessStep["action"],
): ChineseWallAccessStep["action"] {
  switch (action) {
    case "prepare_grant":
      return "prepare_release";
    case "commit_grant":
      return "commit_release";
    case "prepare_release":
      return "prepare_grant";
    case "commit_release":
      return "commit_grant";
    case "audit":
      return "audit";
  }
}
