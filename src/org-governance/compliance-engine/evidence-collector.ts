import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { createLazyStructuredLogger } from "../../platform/shared/observability/lazy-structured-logger.js";

export interface ComplianceEvidenceRecord {
  readonly evidenceId: string;
  readonly frameworkId: string;
  readonly controlId: string;
  readonly source: string;
  readonly artifactRef: string;
  readonly evidenceType?: string;
  readonly collectedBy?: string;
  readonly content?: string;
  readonly sourceSystem?: string;
  readonly timestamp?: string;
  readonly collectedAt: string;
  readonly previousHash?: string;
  readonly hash?: string;
}

export interface ComplianceEvidenceCollectInput {
  readonly frameworkId: string;
  readonly controlId: string;
  readonly source?: string;
  readonly artifactRef?: string;
  readonly evidenceType?: string;
  readonly collectedBy?: string;
  readonly content?: string;
  readonly sourceSystem?: string;
  readonly timestamp?: string;
  readonly collectedAt?: string;
}

export interface ComplianceEvidenceCollectorOptions {
  readonly storagePath?: string | null;
}

export interface EvidenceCollectionSchedule {
  readonly scheduleId: string;
  readonly frameworkId: string;
  readonly controlId: string;
  readonly trigger: EvidenceCollectionTrigger;
  readonly maxAgeMinutes: number | null;
  readonly nextRunAt: string;
  readonly lastRunAt: string | null;
  readonly active: boolean;
}

export type EvidenceCollectionTrigger =
  | { readonly type: "periodic"; readonly intervalMinutes: number }
  | { readonly type: "on_demand" };

interface EvidenceCollectorSnapshot {
  readonly records: Record<string, ComplianceEvidenceRecord[]>;
  readonly schedules: EvidenceCollectionSchedule[];
}

const SNAPSHOT_LOCK_TIMEOUT_MS = 250;
const getEvidenceCollectorLogger = createLazyStructuredLogger({
  retentionLimit: 100,
  service: "compliance-evidence-collector",
});

function firstNonBlank(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return null;
}

function normalizeEvidenceInput(
  input: ComplianceEvidenceCollectInput,
): Omit<ComplianceEvidenceRecord, "evidenceId" | "collectedAt" | "previousHash" | "chainHash"> {
  const source = firstNonBlank(input.source, input.sourceSystem, input.collectedBy);
  if (source == null) {
    throw new Error("compliance_evidence.source_required");
  }
  const artifactRef = firstNonBlank(input.artifactRef, input.content, input.evidenceType);
  if (artifactRef == null) {
    throw new Error("compliance_evidence.artifact_ref_required");
  }
  return {
    ...input,
    source,
    artifactRef,
    ...(input.evidenceType !== undefined ? { evidenceType: input.evidenceType } : {}),
    ...(input.collectedBy !== undefined ? { collectedBy: input.collectedBy } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.sourceSystem !== undefined ? { sourceSystem: input.sourceSystem } : {}),
    ...(input.timestamp !== undefined ? { timestamp: input.timestamp } : {}),
  };
}

function computeNextRunAt(trigger: EvidenceCollectionTrigger, referenceTime: string): string {
  if (trigger.type === "on_demand") {
    return referenceTime;
  }
  return new Date(
    new Date(referenceTime).getTime() + (trigger.intervalMinutes * 60_000),
  ).toISOString();
}

function computeRecordHash(
  record: Omit<ComplianceEvidenceRecord, "hash">,
): string {
  const payload = JSON.stringify({
    evidenceId: record.evidenceId,
    frameworkId: record.frameworkId,
    controlId: record.controlId,
    source: record.source,
    artifactRef: record.artifactRef,
    evidenceType: record.evidenceType ?? null,
    collectedBy: record.collectedBy ?? null,
    content: record.content ?? null,
    sourceSystem: record.sourceSystem ?? null,
    timestamp: record.timestamp ?? null,
    collectedAt: record.collectedAt,
    previousHash: record.previousHash ?? null,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function acquireSnapshotLock(lockPath: string): number {
  mkdirSync(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + SNAPSHOT_LOCK_TIMEOUT_MS;
  while (true) {
    try {
      return openSync(lockPath, "wx");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || (error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      if (Date.now() >= deadline) {
        throw new Error(`compliance_evidence.snapshot_lock_timeout:${lockPath}`);
      }
    }
  }
}

function releaseSnapshotLock(lockFd: number, lockPath: string): void {
  try {
    closeSync(lockFd);
  } finally {
    try {
      rmSync(lockPath, { force: true });
    } catch (error) {
      getEvidenceCollectorLogger().warn("compliance_evidence.lock_cleanup_failed", {
        lockPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function writeSnapshotAtomically(path: string, snapshot: EvidenceCollectorSnapshot): void {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  let renamed = false;
  try {
    writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), "utf8");
    renameSync(tempPath, path);
    renamed = true;
  } finally {
    if (!renamed) {
      try {
        rmSync(tempPath, { force: true });
      } catch (error) {
        getEvidenceCollectorLogger().warn("compliance_evidence.temp_snapshot_cleanup_failed", {
          tempPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

export class ComplianceEvidenceCollector {
  private readonly records = new Map<string, ComplianceEvidenceRecord[]>();
  private readonly schedules = new Map<string, EvidenceCollectionSchedule>();
  private readonly collectionSchedule = new Map<string, { intervalMs: number; lastCollectedAt: string | null }>();
  private readonly pendingCollections = new Map<string, NodeJS.Timeout>();
  private readonly storagePath: string | null;

  public constructor(options: ComplianceEvidenceCollectorOptions = {}) {
    this.storagePath = options.storagePath ?? null;
    this.loadSnapshot();
  }

  public collect(input: ComplianceEvidenceCollectInput): ComplianceEvidenceRecord {
    const normalized = normalizeEvidenceInput(input);
    const existing = this.records.get(normalized.frameworkId) ?? [];
    const previousHash = existing[existing.length - 1]?.hash ?? "GENESIS";
    const recordBase: Omit<ComplianceEvidenceRecord, "hash"> = {
      ...normalized,
      evidenceId: newId("compliance_evidence"),
      collectedAt: input.collectedAt ?? nowIso(),
      previousHash,
    };
    const record: ComplianceEvidenceRecord = {
      ...recordBase,
      hash: computeRecordHash(recordBase),
    };
    const nextRecords = [...existing, record];
    this.records.set(record.frameworkId, nextRecords);
    try {
      this.persistSnapshot();
    } catch (error) {
      if (existing.length === 0) {
        this.records.delete(record.frameworkId);
      } else {
        this.records.set(record.frameworkId, existing);
      }
      throw error;
    }
    return record;
  }

  public list(frameworkId?: string): ComplianceEvidenceRecord[] {
    if (frameworkId == null) {
      return [...this.records.values()].flatMap((items) => items);
    }
    return [...(this.records.get(frameworkId) ?? [])];
  }

  public verifyChain(frameworkId?: string): string[] {
    const frameworks = frameworkId == null ? [...this.records.keys()] : [frameworkId];
    const invalidEvidenceIds: string[] = [];
    for (const key of frameworks) {
      const records = this.records.get(key) ?? [];
      let previousHash: string | null = null;
      for (const record of records) {
        const expectedHash = computeRecordHash({
          ...record,
          previousHash: previousHash ?? "GENESIS",
        });
        const expectedPreviousHash = previousHash ?? "GENESIS";
        if (record.previousHash !== expectedPreviousHash || record.hash !== expectedHash) {
          invalidEvidenceIds.push(record.evidenceId);
        }
        previousHash = record.hash ?? null;
      }
    }
    return invalidEvidenceIds;
  }

  public scheduleEvidenceCollection(
    frameworkId: string,
    controlId: string,
    trigger: EvidenceCollectionTrigger,
    maxAgeMinutes: number | null = null,
  ): EvidenceCollectionSchedule {
    const schedule: EvidenceCollectionSchedule = {
      scheduleId: newId("evidence_schedule"),
      frameworkId,
      controlId,
      trigger,
      maxAgeMinutes,
      nextRunAt: computeNextRunAt(trigger, nowIso()),
      lastRunAt: null,
      active: true,
    };
    this.schedules.set(schedule.scheduleId, schedule);
    try {
      this.persistSnapshot();
    } catch (error) {
      this.schedules.delete(schedule.scheduleId);
      throw error;
    }
    return schedule;
  }

  public listScheduledCollections(): EvidenceCollectionSchedule[] {
    return [...this.schedules.values()];
  }

  public getDueCollections(referenceTime: string): EvidenceCollectionSchedule[] {
    return this.listScheduledCollections().filter((schedule) =>
      schedule.active && (schedule.trigger.type === "on_demand" || schedule.nextRunAt <= referenceTime),
    );
  }

  public deactivateSchedule(scheduleId: string): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }
    this.schedules.set(scheduleId, {
      ...schedule,
      active: false,
    });
    try {
      this.persistSnapshot();
    } catch (error) {
      this.schedules.set(scheduleId, schedule);
      throw error;
    }
    return true;
  }

  public scheduleCollection(frameworkId: string, intervalMs: number): void {
    this.collectionSchedule.set(frameworkId, {
      intervalMs,
      lastCollectedAt: null,
    });
  }

  public startPeriodicCollection(
    frameworkId: string,
    collectorFn: () => ComplianceEvidenceCollectInput[],
  ): void {
    const schedule = this.collectionSchedule.get(frameworkId);
    if (!schedule) {
      throw new Error(`compliance_collector.schedule_not_found:${frameworkId}`);
    }

    const existing = this.pendingCollections.get(frameworkId);
    if (existing) {
      clearTimeout(existing);
    }

    const runCollection = () => {
      const collectedAt = nowIso();
      const records = collectorFn();
      for (const input of records) {
        this.collect(input);
      }
      const updatedSchedule = this.collectionSchedule.get(frameworkId);
      if (updatedSchedule) {
        updatedSchedule.lastCollectedAt = collectedAt;
      }
      const nextSchedule = this.collectionSchedule.get(frameworkId);
      if (nextSchedule) {
        const timeout = setTimeout(runCollection, nextSchedule.intervalMs);
        timeout.unref?.();
        this.pendingCollections.set(frameworkId, timeout);
      }
    };

    const timeout = setTimeout(runCollection, schedule.intervalMs);
    timeout.unref?.();
    this.pendingCollections.set(frameworkId, timeout);
  }

  public stopPeriodicCollection(frameworkId: string): void {
    const existing = this.pendingCollections.get(frameworkId);
    if (existing) {
      clearTimeout(existing);
      this.pendingCollections.delete(frameworkId);
    }
  }

  public isFresh(frameworkId: string, maxAgeMs: number): boolean {
    const records = this.records.get(frameworkId);
    if (!records || records.length === 0) {
      return false;
    }
    const latestTimestamp = records[records.length - 1]?.collectedAt;
    if (!latestTimestamp) {
      return false;
    }
    const ageMs = Date.now() - new Date(latestTimestamp).getTime();
    return ageMs <= maxAgeMs;
  }

  public getFreshnessInfo(frameworkId: string): { lastCollectedAt: string | null; recordCount: number } | null {
    const records = this.records.get(frameworkId);
    if (!records || records.length === 0) {
      return null;
    }
    return {
      lastCollectedAt: records[records.length - 1]?.collectedAt ?? null,
      recordCount: records.length,
    };
  }

  private loadSnapshot(): void {
    if (!this.storagePath || !existsSync(this.storagePath)) {
      return;
    }
    const raw = readFileSync(this.storagePath, "utf8");
    if (raw.trim().length === 0) {
      return;
    }
    const snapshot = JSON.parse(raw) as EvidenceCollectorSnapshot;
    for (const [frameworkId, records] of Object.entries(snapshot.records ?? {})) {
      this.records.set(frameworkId, records);
    }
    for (const schedule of snapshot.schedules ?? []) {
      this.schedules.set(schedule.scheduleId, schedule);
    }
  }

  private persistSnapshot(): void {
    if (!this.storagePath) {
      return;
    }
    const snapshot: EvidenceCollectorSnapshot = {
      records: Object.fromEntries(
        [...this.records.entries()].map(([frameworkId, records]) => [frameworkId, records]),
      ),
      schedules: this.listScheduledCollections(),
    };
    const lockPath = `${this.storagePath}.lock`;
    const lockFd = acquireSnapshotLock(lockPath);
    try {
      writeSnapshotAtomically(this.storagePath, snapshot);
    } finally {
      releaseSnapshotLock(lockFd, lockPath);
    }
  }
}
