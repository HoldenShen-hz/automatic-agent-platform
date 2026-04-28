import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessDecision,
  type HarnessRun,
  type HarnessRole,
  type HarnessTimelineEvent,
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
    return this.runtime.createRun(input);
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
    return this.runtime.appendStep(run, runtimeInput);
  }

  public decide(input: Parameters<HarnessRuntimeService["decide"]>[0]): HarnessDecision {
    return this.runtime.decide(input);
  }

  public evaluate(run: HarnessRun) {
    return this.runtime.evaluateRun(run);
  }

  public persist(run: HarnessRun): HarnessRun {
    this.runtime.persistRun(run);
    return run;
  }

  public checkpoint(run: HarnessRun): string {
    return this.runtime.checkpointRun(run);
  }

  public restore(runId: string): HarnessRun | null {
    return this.runtime.restoreRun(runId);
  }

  public restoreFromCheckpoint(checkpointRef: string): HarnessRun | null {
    return this.runtime.restoreFromCheckpoint(checkpointRef);
  }

  public assertInvariants(run: HarnessRun) {
    return this.runtime.assertInvariants(run);
  }

  public sleep(runOrId: HarnessRun | string, reason: string, resumeAt: string): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.sleep(run, reason, resumeAt);
  }

  public resume(runOrId: HarnessRun | string): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.resume(run);
  }

  public requestHumanReview(
    runOrId: HarnessRun | string,
    reason: string,
    evidenceRefs: readonly string[] = [],
  ): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.openHitlReview(run, reason, evidenceRefs);
  }

  public resolveReview(
    runOrId: HarnessRun | string,
    resolution: "approved" | "rejected",
    actorId: string,
  ): HarnessRun {
    const run = this.requireRun(runOrId);
    return this.runtime.resolveHitlReview(run, resolution, actorId);
  }

  public getTimeline(runOrId: HarnessRun | string): readonly HarnessTimelineEvent[] {
    const run = this.requireRun(runOrId);
    return this.runtime.listTimeline(run);
  }

  public getEvaluation(runOrId: HarnessRun | string) {
    const run = this.requireRun(runOrId);
    return this.runtime.evaluateRun(run);
  }

  private requireRun(runOrId: HarnessRun | string): HarnessRun {
    if (typeof runOrId !== "string") {
      return runOrId;
    }
    const restored = this.runtime.restoreRun(runOrId);
    if (restored == null) {
      throw new Error(`harness_sdk.run_not_found:${runOrId}`);
    }
    return restored;
  }
}
