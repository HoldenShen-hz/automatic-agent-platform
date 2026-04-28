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
    const committedActions: ChineseWallAccessStep["action"][] = [];
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
        this.handlers.prepareGrant?.(step, context());
        preparedSet.add(step.stepId);
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          outcome: "prepared",
        });
        continue;
      }

      if (step.action === "commit_grant" || step.action === "commit_release") {
        if (!preparedSet.has(step.stepId.replace("commit_", "prepare_"))) {
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
        this.runAction(step, context());
        committedActions.push(step.action);
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          outcome: "committed",
        });
      }
    }

    const failed = failedAction != null;
    const compensatedActions = failed
      ? [...committedActions]
        .reverse()
        .map((action) => action === "commit_grant"
          ? "prepare_release"
          : action === "prepare_grant"
            ? "commit_release"
            : action)
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
}
