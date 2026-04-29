export interface ChineseWallAccessStep {
  readonly stepId: string;
  readonly action: "prepare_grant" | "commit_grant" | "prepare_release" | "commit_release" | "audit";
  readonly succeeded: boolean;
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

export class ChineseWallAccessSaga {
  public constructor(private readonly handlers: ChineseWallAccessSagaHandlers = {}) {}

  public execute(accessId: string, steps: readonly ChineseWallAccessStep[]): ChineseWallAccessSagaReceipt {
    const successfulActions: ChineseWallAccessStep["action"][] = [];
    const executionLog: Array<ChineseWallAccessSagaReceipt["executionLog"][number]> = [];
    let failedAction: ChineseWallAccessStep["action"] | null = null;
    const context = (): ChineseWallAccessSagaHandlerContext => ({ accessId, failedAction });

    const preparedSet = new Set<string>();

    for (const step of steps) {
      if (step.action === "audit") {
        this.handlers.audit?.(step, context());
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          outcome: "audited",
        });
        continue;
      }

      if (step.action === "prepare_grant" || step.action === "prepare_release") {
        try {
          this.runAction(step, context());
          preparedSet.add(step.stepId);
          successfulActions.push(step.action);
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
        continue;
      }

      if (step.action === "commit_grant" || step.action === "commit_release") {
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
          successfulActions.push(step.action);
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

    const failed = failedAction != null;
    const compensatedActions = failed
      ? [...successfulActions]
        .reverse()
        .map(invertActionForCompensation)
      : [];
    if (failed) {
      for (const action of compensatedActions) {
        const syntheticStep: ChineseWallAccessStep = {
          stepId: `${accessId}:${action}`,
          action,
          succeeded: true,
        };
        this.runAction(syntheticStep, context());
        executionLog.push({
          stepId: syntheticStep.stepId,
          action: syntheticStep.action,
          outcome: "compensated",
        });
      }
    }

    return {
      accessId,
      status: failed ? "rolled_back" : "committed",
      committedActions: failed ? [] : successfulActions,
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
