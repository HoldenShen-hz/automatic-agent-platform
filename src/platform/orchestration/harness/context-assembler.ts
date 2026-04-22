import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import type { ContextSnapshot, HarnessRun } from "./index.js";

export interface HarnessContextSourceSet {
  readonly conversation?: Readonly<Record<string, unknown>>;
  readonly task?: Readonly<Record<string, unknown>>;
  readonly memory?: Readonly<Record<string, unknown>>;
  readonly knowledge?: Readonly<Record<string, unknown>>;
}

export interface HarnessContext {
  readonly contextId: string;
  readonly tokenBudget: number;
  readonly conversation: Readonly<Record<string, unknown>>;
  readonly task: Readonly<Record<string, unknown>>;
  readonly memory: Readonly<Record<string, unknown>>;
  readonly knowledge: Readonly<Record<string, unknown>>;
  readonly assembledAt: string;
}

export class ContextAssembler {
  public assemble(sources: HarnessContextSourceSet, tokenBudget: number): HarnessContext {
    return {
      contextId: newId("harness_context"),
      tokenBudget,
      conversation: { ...(sources.conversation ?? {}) },
      task: { ...(sources.task ?? {}) },
      memory: { ...(sources.memory ?? {}) },
      knowledge: { ...(sources.knowledge ?? {}) },
      assembledAt: nowIso(),
    };
  }

  public snapshot(run: HarnessRun, context: HarnessContext): ContextSnapshot {
    return {
      snapshotId: newId("ctx_snapshot"),
      runId: run.runId,
      domainId: run.domainId,
      iteration: run.currentIteration,
      stepCount: run.steps.length,
      lastDecisionId: run.decision?.decisionId ?? null,
      capturedAt: context.assembledAt,
    };
  }
}
