import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessDecision,
  type HarnessRun,
  type HarnessRole,
  type HarnessTimelineEvent,
  type HarnessRunRuntimeState,
} from "../../platform/orchestration/harness/index.js";

export interface HarnessSdkCreateRunInput {
  readonly taskId: string;
  readonly domainId: string;
  readonly constraintPack: ConstraintPack;
}

export interface HarnessSdkAppendStepInput {
  readonly role: HarnessRole;
  readonly nodeRunId: string;
  readonly planGraphId: string;
  readonly stage?: string;
  readonly phase?: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly iteration?: number;
}

export class HarnessSdk {
  public constructor(private readonly runtime: HarnessRuntimeService = new HarnessRuntimeService()) {}

  public createRun(input: HarnessSdkCreateRunInput): HarnessRun {
    return this.runtime.createRun(input) as unknown as HarnessRun;
  }

  public appendStep(run: HarnessRun, input: HarnessSdkAppendStepInput): HarnessRun {
    const runtimeInput = {
      role: input.role,
      stage: input.phase ?? input.stage ?? input.nodeRunId,
      inputs: {
        ...input.inputs,
        nodeRunId: input.nodeRunId,
        planGraphId: input.planGraphId,
      },
      outputs: input.outputs,
      ...(input.iteration !== undefined ? { iteration: input.iteration } : {}),
    };
    return this.runtime.appendStep(run as unknown as HarnessRunRuntimeState, runtimeInput) as unknown as HarnessRun;
  }

  public decide(input: Parameters<HarnessRuntimeService["decide"]>[0]): HarnessDecision {
    return this.runtime.decide(input);
  }

  public evaluate(run: HarnessRun) {
    return this.runtime.evaluateRun(run as unknown as HarnessRunRuntimeState);
  }

  public persist(run: HarnessRun): HarnessRun {
    this.runtime.persistRun(run as unknown as HarnessRunRuntimeState);
    return run;
  }

  public checkpoint(run: HarnessRun): string {
    return this.runtime.checkpointRun(run as unknown as HarnessRunRuntimeState);
  }

  public restore(runId: string): HarnessRun | null {
    return (this.runtime.restoreRun(runId) as unknown as HarnessRun) ?? null;
  }

  public restoreFromCheckpoint(checkpointRef: string): HarnessRun | null {
    return (this.runtime.restoreFromCheckpoint(checkpointRef) as unknown as HarnessRun) ?? null;
  }

  public assertInvariants(run: HarnessRun) {
    return this.runtime.assertInvariants(run as unknown as HarnessRunRuntimeState);
  }

  public sleep(runOrId: HarnessRun | string, reason: string, resumeAt: string): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.sleep(run as unknown as HarnessRunRuntimeState, reason, resumeAt) as unknown as HarnessRun;
  }

  public resume(runOrId: HarnessRun | string): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.resume(run as unknown as HarnessRunRuntimeState) as unknown as HarnessRun;
  }

  public requestHumanReview(
    runOrId: HarnessRun | string,
    reason: string,
    evidenceRefs: readonly string[] = [],
  ): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.openHitlReview(run as unknown as HarnessRunRuntimeState, reason, evidenceRefs) as unknown as HarnessRun;
  }

  public resolveReview(
    runOrId: HarnessRun | string,
    resolution: "approved" | "rejected",
    actorId: string,
  ): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.resolveHitlReview(run as unknown as HarnessRunRuntimeState, resolution, actorId) as unknown as HarnessRun;
  }

  public getTimeline(runOrId: HarnessRun | string): readonly HarnessTimelineEvent[] {
    const run = this.requireRun(runOrId);
    return this.runtime.listTimeline(run as unknown as HarnessRunRuntimeState);
  }

  public getEvaluation(runOrId: HarnessRun | string) {
    const run = this.requireRun(runOrId);
    return this.runtime.evaluateRun(run as unknown as HarnessRunRuntimeState);
  }

  public traceReplay(runOrId: string, _traceEvents: readonly HarnessTimelineEvent[]): HarnessRun | null {
    // traceReplay placeholder - HarnessRuntimeService.replayFromTrace not yet implemented
    return (this.runtime.restoreRun(runOrId) as unknown as HarnessRun) ?? null;
  }

  public sideEffectReconciliation(runOrId: HarnessRun | string): HarnessRun {
    // sideEffectReconciliation placeholder - HarnessRuntimeService.reconcileSideEffects not yet implemented
    const run = this.requireRun(runOrId);
    this.runtime.persistRun(run as unknown as HarnessRunRuntimeState);
    return run;
  }

  private requireRun(runOrId: HarnessRun | string): HarnessRunRuntimeState {
    if (typeof runOrId !== "string") {
      return runOrId as unknown as HarnessRunRuntimeState;
    }
    const restored = this.runtime.restoreRun(runOrId);
    if (restored == null) {
      throw new Error(`harness_sdk.run_not_found:${runOrId}`);
    }
    return restored;
  }
}