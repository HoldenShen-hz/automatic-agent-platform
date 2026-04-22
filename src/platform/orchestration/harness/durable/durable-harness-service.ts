import { newId, nowIso } from "../../../../platform/contracts/types/ids.js";
import type { HarnessRun } from "../index.js";

export interface DurableHarnessRecord {
  readonly recordId: string;
  readonly run: HarnessRun;
  readonly checkpointRef: string | null;
  readonly persistedAt: string;
}

export class DurableHarnessService {
  private readonly runs = new Map<string, DurableHarnessRecord>();
  private readonly checkpoints = new Map<string, HarnessRun>();

  public persist(run: HarnessRun): DurableHarnessRecord {
    const existing = this.runs.get(run.runId);
    const record: DurableHarnessRecord = {
      recordId: existing?.recordId ?? newId("durable_run"),
      run,
      checkpointRef: existing?.checkpointRef ?? null,
      persistedAt: nowIso(),
    };
    this.runs.set(run.runId, record);
    return record;
  }

  public checkpoint(run: HarnessRun): string {
    const checkpointRef = newId("harness_checkpoint");
    this.checkpoints.set(checkpointRef, run);
    const record = this.persist(run);
    this.runs.set(run.runId, {
      ...record,
      checkpointRef,
      persistedAt: nowIso(),
    });
    return checkpointRef;
  }

  public restore(runId: string): HarnessRun | null {
    return this.runs.get(runId)?.run ?? null;
  }

  public restoreFromCheckpoint(checkpointRef: string): HarnessRun | null {
    return this.checkpoints.get(checkpointRef) ?? null;
  }

  public getCheckpointRef(runId: string): string | null {
    return this.runs.get(runId)?.checkpointRef ?? null;
  }
}
