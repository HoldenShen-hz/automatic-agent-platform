import { DatabaseSync } from "node:sqlite";
import { newId, nowIso } from "../../../../platform/contracts/types/ids.js";
import type { HarnessRun, WorkflowSleepLease } from "../index.js";

export interface DurableHarnessRecord {
  readonly recordId: string;
  readonly run: HarnessRun;
  readonly checkpointRef: string | null;
  readonly persistedAt: string;
}

export interface DurableHarnessStore {
  saveRecord(record: DurableHarnessRecord): void;
  getRecord(runId: string): DurableHarnessRecord | null;
  saveCheckpoint(checkpointRef: string, run: HarnessRun): void;
  getCheckpoint(checkpointRef: string): HarnessRun | null;
  listRecords(): DurableHarnessRecord[];
}

export class InMemoryDurableHarnessStore implements DurableHarnessStore {
  private readonly runs = new Map<string, DurableHarnessRecord>();
  private readonly checkpoints = new Map<string, HarnessRun>();

  public saveRecord(record: DurableHarnessRecord): void {
    this.runs.set(record.run.runId, record);
  }

  public getRecord(runId: string): DurableHarnessRecord | null {
    return this.runs.get(runId) ?? null;
  }

  public saveCheckpoint(checkpointRef: string, run: HarnessRun): void {
    this.checkpoints.set(checkpointRef, run);
  }

  public getCheckpoint(checkpointRef: string): HarnessRun | null {
    return this.checkpoints.get(checkpointRef) ?? null;
  }

  public listRecords(): DurableHarnessRecord[] {
    return [...this.runs.values()];
  }
}

export class SqliteDurableHarnessStore implements DurableHarnessStore {
  public constructor(private readonly db: DatabaseSync) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS harness_runs (
        run_id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        run_json TEXT NOT NULL,
        checkpoint_ref TEXT,
        persisted_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS harness_checkpoints (
        checkpoint_ref TEXT PRIMARY KEY,
        run_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  public saveRecord(record: DurableHarnessRecord): void {
    this.db.prepare(`
      INSERT INTO harness_runs (run_id, record_id, run_json, checkpoint_ref, persisted_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        record_id = excluded.record_id,
        run_json = excluded.run_json,
        checkpoint_ref = excluded.checkpoint_ref,
        persisted_at = excluded.persisted_at
    `).run(
      record.run.runId,
      record.recordId,
      JSON.stringify(record.run),
      record.checkpointRef,
      record.persistedAt,
    );
  }

  public getRecord(runId: string): DurableHarnessRecord | null {
    const row = this.db.prepare(`
      SELECT record_id, run_json, checkpoint_ref, persisted_at
      FROM harness_runs
      WHERE run_id = ?
    `).get(runId) as { record_id: string; run_json: string; checkpoint_ref: string | null; persisted_at: string } | undefined;
    if (!row) {
      return null;
    }
    return {
      recordId: row.record_id,
      run: JSON.parse(row.run_json) as HarnessRun,
      checkpointRef: row.checkpoint_ref,
      persistedAt: row.persisted_at,
    };
  }

  public saveCheckpoint(checkpointRef: string, run: HarnessRun): void {
    this.db.prepare(`
      INSERT INTO harness_checkpoints (checkpoint_ref, run_json, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(checkpoint_ref) DO UPDATE SET
        run_json = excluded.run_json,
        created_at = excluded.created_at
    `).run(checkpointRef, JSON.stringify(run), nowIso());
  }

  public getCheckpoint(checkpointRef: string): HarnessRun | null {
    const row = this.db.prepare(`
      SELECT run_json FROM harness_checkpoints WHERE checkpoint_ref = ?
    `).get(checkpointRef) as { run_json: string } | undefined;
    return row ? JSON.parse(row.run_json) as HarnessRun : null;
  }

  public listRecords(): DurableHarnessRecord[] {
    const rows = this.db.prepare(`
      SELECT record_id, run_json, checkpoint_ref, persisted_at
      FROM harness_runs
      ORDER BY persisted_at DESC
    `).all() as { record_id: string; run_json: string; checkpoint_ref: string | null; persisted_at: string }[];
    return rows.map((row) => ({
      recordId: row.record_id,
      run: JSON.parse(row.run_json) as HarnessRun,
      checkpointRef: row.checkpoint_ref,
      persistedAt: row.persisted_at,
    }));
  }
}

export class DurableHarnessService {
  private readonly store: DurableHarnessStore;
  private readonly validateRun: ((run: HarnessRun) => void) | null;

  public constructor(options: {
    store?: DurableHarnessStore;
    validateRun?: ((run: HarnessRun) => void) | null;
  } = {}) {
    this.store = options.store ?? new InMemoryDurableHarnessStore();
    this.validateRun = options.validateRun ?? null;
  }

  public persist(run: HarnessRun): DurableHarnessRecord {
    this.validateRun?.(run);
    const existing = this.store.getRecord(run.runId);
    const record: DurableHarnessRecord = {
      recordId: existing?.recordId ?? newId("durable_run"),
      run,
      checkpointRef: existing?.checkpointRef ?? null,
      persistedAt: nowIso(),
    };
    this.store.saveRecord(record);
    return record;
  }

  public checkpoint(run: HarnessRun): string {
    this.validateRun?.(run);
    const checkpointRef = newId("harness_checkpoint");
    this.store.saveCheckpoint(checkpointRef, run);
    const record = this.persist(run);
    this.store.saveRecord({
      ...record,
      checkpointRef,
      persistedAt: nowIso(),
    });
    return checkpointRef;
  }

  public restore(runId: string): HarnessRun | null {
    const run = this.store.getRecord(runId)?.run ?? null;
    if (run) {
      this.validateRun?.(run);
    }
    return run;
  }

  public restoreFromCheckpoint(checkpointRef: string): HarnessRun | null {
    const run = this.store.getCheckpoint(checkpointRef);
    if (run) {
      this.validateRun?.(run);
    }
    return run;
  }

  public getCheckpointRef(runId: string): string | null {
    return this.store.getRecord(runId)?.checkpointRef ?? null;
  }

  public listDueSleepLeases(referenceTime = nowIso()): WorkflowSleepLease[] {
    return this.store
      .listRecords()
      .map((record) => record.run.sleepLease)
      .filter((lease): lease is WorkflowSleepLease => lease != null && lease.resumeAt <= referenceTime);
  }
}
