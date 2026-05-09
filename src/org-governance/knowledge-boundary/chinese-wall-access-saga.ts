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
    readonly outcome: "committed" | "compensated" | "audited" | "failed";
  }[];
}

export class ChineseWallAccessSaga {
  public constructor(private readonly handlers: ChineseWallAccessSagaHandlers = {}) {}

  public execute(accessId: string, steps: readonly ChineseWallAccessStep[]): ChineseWallAccessSagaReceipt {
    // Two-phase commit: Phase 1 (prepare) - all participants vote yes/no
    const prepareResults: Array<{ action: ChineseWallAccessStep["action"]; votedYes: boolean }> = [];
    let failedAction: ChineseWallAccessStep["action"] | null = null;
    const context = (): ChineseWallAccessSagaHandlerContext => ({ accessId, failedAction });

    for (const step of steps) {
      if (step.action === "audit") {
        this.handlers.audit?.(step, context());
        continue;
      }
      if (step.action === "prepare_grant" || step.action === "prepare_release") {
        // Phase 1: Prepare voting - call the handler to check if it can commit
        this.runAction(step, context());
        const votedYes = step.succeeded;
        prepareResults.push({ action: step.action, votedYes });
        if (!votedYes) {
          failedAction = step.action;
          break;
        }
      }
    }

    // Phase 2: Commit or Rollback based on prepare results
    const committedActions: ChineseWallAccessStep["action"][] = [];
    const executionLog: Array<ChineseWallAccessSagaReceipt["executionLog"][number]> = [];
    const failed = failedAction != null;

    if (failed) {
      // Phase 2a: Rollback - compensate all prepared actions
      for (const { action } of prepareResults.reverse()) {
        const rollbackAction = action === "prepare_grant" ? "commit_release" : "commit_release";
        const syntheticStep: ChineseWallAccessStep = {
          stepId: `${accessId}:rollback:${action}`,
          action: rollbackAction,
          succeeded: true,
        };
        this.runAction(syntheticStep, context());
        executionLog.push({
          stepId: syntheticStep.stepId,
          action: syntheticStep.action,
          outcome: "compensated",
        });
      }
    } else {
      // Phase 2b: Commit - execute all committed actions in order
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
        if (step.action === "prepare_grant") {
          const commitStep: ChineseWallAccessStep = { ...step, action: "commit_grant" };
          this.runAction(commitStep, context());
          committedActions.push("commit_grant");
          executionLog.push({
            stepId: commitStep.stepId,
            action: "commit_grant",
            outcome: "committed",
          });
        } else if (step.action === "prepare_release") {
          const commitStep: ChineseWallAccessStep = { ...step, action: "commit_release" };
          this.runAction(commitStep, context());
          committedActions.push("commit_release");
          executionLog.push({
            stepId: commitStep.stepId,
            action: "commit_release",
            outcome: "committed",
          });
        }
      }
    }

    return {
      accessId,
      status: failed ? "rolled_back" : "committed",
      committedActions: failed ? [] : committedActions,
      rollbackRequired: failed,
      compensatedActions: failed ? prepareResults.map((r) => r.action) : [],
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
