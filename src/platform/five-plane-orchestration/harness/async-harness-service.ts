import { type HarnessLoopInput, type HarnessRunRuntimeState, type HarnessRunStatus, type HarnessRuntimeService } from "./index.js";

export interface AsyncHarnessQueuedRun {
  readonly runId: string;
  readonly input: HarnessLoopInput;
  readonly status: "queued" | "running" | "completed" | "failed";
  readonly result: HarnessRunRuntimeState | null;
  readonly errorMessage: string | null;
}

export class AsyncHarnessService {
  private readonly queuedRuns = new Map<string, AsyncHarnessQueuedRun>();

  public constructor(private readonly runtime: HarnessRuntimeService) {}

  public async createRun(input: HarnessLoopInput): Promise<string> {
    const runId = this.runtime.createRun({
      taskId: input.taskId,
      domainId: input.domainId,
      constraintPack: input.constraintPack,
    }).runId;
    this.queuedRuns.set(runId, {
      runId,
      input,
      status: "queued",
      result: null,
      errorMessage: null,
    });
    return runId;
  }

  public async execute(runId: string): Promise<HarnessRunRuntimeState> {
    const queued = this.requireRun(runId);
    this.queuedRuns.set(runId, { ...queued, status: "running" });
    try {
      const result = this.runtime.runLoop(queued.input);
      this.queuedRuns.set(runId, {
        ...queued,
        status: "completed",
        result,
        errorMessage: null,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.queuedRuns.set(runId, {
        ...queued,
        status: "failed",
        result: null,
        errorMessage: message,
      });
      throw error;
    }
  }

  public get(runId: string): AsyncHarnessQueuedRun | null {
    return this.queuedRuns.get(runId) ?? null;
  }

  public getRunStatus(runId: string): AsyncHarnessQueuedRun["status"] | HarnessRunStatus | null {
    const queued = this.queuedRuns.get(runId);
    if (!queued) {
      return null;
    }
    return queued.result?.status ?? queued.status;
  }

  private requireRun(runId: string): AsyncHarnessQueuedRun {
    const queued = this.queuedRuns.get(runId);
    if (!queued) {
      throw new Error(`harness.async.run_not_found:${runId}`);
    }
    return queued;
  }
}
