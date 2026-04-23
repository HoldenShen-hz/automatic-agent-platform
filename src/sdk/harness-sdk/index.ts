import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessDecision,
  type HarnessRun,
  type HarnessRole,
} from "../../platform/orchestration/harness/index.js";

export interface HarnessSdkCreateRunInput {
  readonly taskId: string;
  readonly domainId: string;
  readonly constraintPack: ConstraintPack;
}

export interface HarnessSdkAppendStepInput {
  readonly role: HarnessRole;
  readonly stage: string;
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
    return this.runtime.appendStep(run, input);
  }

  public decide(input: Parameters<HarnessRuntimeService["decide"]>[0]): HarnessDecision {
    return this.runtime.decide(input);
  }

  public evaluate(run: HarnessRun) {
    return this.runtime.evaluateRun(run);
  }

  public persist(run: HarnessRun) {
    return this.runtime.persistRun(run);
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
}
