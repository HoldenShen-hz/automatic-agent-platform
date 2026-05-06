import { createHash } from "crypto";
import { dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

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
  /** §R21-32: Hash chain for tamper-proof audit evidence */
  readonly previousHash: string;
  readonly hash: string;
}

/** @internal Computes SHA-256 hash of a record for hash chain */
function computeRecordHash(record: Omit<ComplianceEvidenceRecord, "hash" | "previousHash">): string {
  const payload = JSON.stringify({
    evidenceId: record.evidenceId,
    frameworkId: record.frameworkId,
    controlId: record.controlId,
    source: record.source,
    artifactRef: record.artifactRef,
    evidenceType: record.evidenceType,
    collectedBy: record.collectedBy,
    content: record.content,
    sourceSystem: record.sourceSystem,
    timestamp: record.timestamp,
    collectedAt: record.collectedAt,
  });
  return createHash("sha256").update(payload).digest("hex");
}

type ComplianceEvidenceCollectInput =
  Omit<ComplianceEvidenceRecord, "evidenceId" | "collectedAt" | "previousHash" | "hash"> & { collectedAt?: string };

function normalizeEvidenceInput(input: ComplianceEvidenceCollectInput): Omit<ComplianceEvidenceRecord, "evidenceId" | "collectedAt" | "previousHash" | "hash"> {
  const source = input.source
    ?? input.sourceSystem
    ?? input.collectedBy
    ?? "unknown";
  const artifactRef = input.artifactRef
    ?? input.content
    ?? input.evidenceType
    ?? "unspecified";
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

export type EvidenceCollectionSchedule =
  | { type: "periodic"; intervalMinutes: number }
  | { type: "quarterly" }
  | { type: "continuous" }
  | { type: "on_demand" };

export interface ScheduledEvidenceCollection {
  readonly scheduleId: string;
  readonly frameworkId: string;
  readonly controlId: string;
  readonly schedule: EvidenceCollectionSchedule;
  readonly nextRunAt: string;
  readonly lastCollectedAt: string | null;
  readonly freshnessDeadline: string | null;
  readonly active: boolean;
}

export interface EvidenceCollectionJob {
  readonly frameworkId: string;
  readonly controlIds: readonly string[];
  readonly collectedAt: string;
  readonly results: readonly ComplianceEvidenceRecord[];
}

export interface ComplianceEvidenceCollectorOptions {
  readonly storagePath?: string;
}

interface ComplianceEvidenceCollectorSnapshot {
  readonly schemaVersion: 1;
  readonly records: readonly ComplianceEvidenceRecord[];
  readonly scheduledCollections: readonly ScheduledEvidenceCollection[];
  readonly lastHashByFramework: Readonly<Record<string, string>>;
}

export class ComplianceEvidenceCollector {
  private readonly records = new Map<string, ComplianceEvidenceRecord[]>();
  private readonly scheduledCollections = new Map<string, ScheduledEvidenceCollection>();
  /** §R21-32: Last hash per framework for hash chain continuity */
  private readonly lastHashByFramework = new Map<string, string>();
  private readonly storagePath: string | null;

  public constructor(options: ComplianceEvidenceCollectorOptions = {}) {
    this.storagePath = options.storagePath ?? null;
    this.loadSnapshot();
  }

  public collect(
    input: ComplianceEvidenceCollectInput,
  ): ComplianceEvidenceRecord {
    const normalized = normalizeEvidenceInput(input);
    const previousHash = this.lastHashByFramework.get(normalized.frameworkId) ?? "GENESIS";
    const baseRecord = {
      ...normalized,
      evidenceId: newId("compliance_evidence"),
      collectedAt: input.collectedAt ?? nowIso(),
      previousHash,
    };
    const hash = computeRecordHash(baseRecord);
    const record: ComplianceEvidenceRecord = {
      ...baseRecord,
      hash,
    };
    this.lastHashByFramework.set(record.frameworkId, hash);
    this.records.set(record.frameworkId, [...(this.records.get(record.frameworkId) ?? []), record]);
    this.persistSnapshot();
    return record;
  }

  public list(frameworkId?: string): ComplianceEvidenceRecord[] {
    if (frameworkId == null) {
      return [...this.records.values()].flatMap((items) => items);
    }
    return [...(this.records.get(frameworkId) ?? [])];
  }

  public scheduleEvidenceCollection(
    frameworkId: string,
    controlId: string,
    schedule: EvidenceCollectionSchedule,
    freshnessDeadlineMinutes?: number,
  ): ScheduledEvidenceCollection {
    const scheduleId = newId("evidence_schedule");
    const now = nowIso();
    const nextRunAt = computeNextRunTime(now, schedule);
    const freshnessDeadline = freshnessDeadlineMinutes != null
      ? new Date(Date.parse(now) + freshnessDeadlineMinutes * 60_000).toISOString()
      : null;
    const scheduled: ScheduledEvidenceCollection = {
      scheduleId,
      frameworkId,
      controlId,
      schedule,
      nextRunAt,
      lastCollectedAt: null,
      freshnessDeadline,
      active: true,
    };
    this.scheduledCollections.set(scheduleId, scheduled);
    this.persistSnapshot();
    return scheduled;
  }

  public listScheduledCollections(frameworkId?: string): ScheduledEvidenceCollection[] {
    const all = [...this.scheduledCollections.values()];
    if (frameworkId != null) {
      return all.filter((s) => s.frameworkId === frameworkId);
    }
    return all;
  }

  public getDueCollections(nowIsoStr?: string): ScheduledEvidenceCollection[] {
    const now = nowIsoStr ?? nowIso();
    return [...this.scheduledCollections.values()].filter(
      (s) => s.active && Date.parse(s.nextRunAt) <= Date.parse(now),
    );
  }

  public executeScheduledCollection(
    scheduleId: string,
    collector: (controlId: string) => ComplianceEvidenceCollectInput,
  ): EvidenceCollectionJob | null {
    const schedule = this.scheduledCollections.get(scheduleId);
    if (schedule == null || !schedule.active) {
      return null;
    }
    const results: ComplianceEvidenceRecord[] = [];
    const input = collector(schedule.controlId);
    const record = this.collect(input);
    results.push(record);
    const newLastCollectedAt = nowIso();
    const updatedSchedule: ScheduledEvidenceCollection = {
      ...schedule,
      lastCollectedAt: newLastCollectedAt,
      nextRunAt: computeNextRunTime(newLastCollectedAt, schedule.schedule),
    };
    this.scheduledCollections.set(scheduleId, updatedSchedule);
    this.persistSnapshot();
    return {
      frameworkId: schedule.frameworkId,
      controlIds: [schedule.controlId],
      collectedAt: newLastCollectedAt,
      results,
    };
  }

  public checkFreshness(scheduleId: string, nowIsoStr?: string): boolean {
    const schedule = this.scheduledCollections.get(scheduleId);
    if (schedule == null) {
      return false;
    }
    const now = nowIsoStr ?? nowIso();
    if (schedule.freshnessDeadline == null) {
      return true;
    }
    return Date.parse(now) < Date.parse(schedule.freshnessDeadline);
  }

  public deactivateSchedule(scheduleId: string): boolean {
    const schedule = this.scheduledCollections.get(scheduleId);
    if (schedule == null) {
      return false;
    }
    this.scheduledCollections.set(scheduleId, { ...schedule, active: false });
    this.persistSnapshot();
    return true;
  }

  /** §R21-32: Verify hash chain integrity for a framework - returns list of tampered evidenceIds */
  public verifyChain(frameworkId: string): readonly string[] {
    const records = this.records.get(frameworkId) ?? [];
    const tampered: string[] = [];
    let expectedPreviousHash = "GENESIS";
    for (const record of records) {
      if (record.previousHash !== expectedPreviousHash) {
        tampered.push(record.evidenceId);
      } else {
        // Recompute hash and verify
        const baseRecord: Omit<ComplianceEvidenceRecord, "hash" | "previousHash"> = {
          evidenceId: record.evidenceId,
          frameworkId: record.frameworkId,
          controlId: record.controlId,
          source: record.source,
          artifactRef: record.artifactRef,
          collectedAt: record.collectedAt,
          ...(record.evidenceType !== undefined ? { evidenceType: record.evidenceType } : {}),
          ...(record.collectedBy !== undefined ? { collectedBy: record.collectedBy } : {}),
          ...(record.content !== undefined ? { content: record.content } : {}),
          ...(record.sourceSystem !== undefined ? { sourceSystem: record.sourceSystem } : {}),
          ...(record.timestamp !== undefined ? { timestamp: record.timestamp } : {}),
        };
        const computedHash = computeRecordHash(baseRecord);
        if (computedHash !== record.hash) {
          tampered.push(record.evidenceId);
        }
        expectedPreviousHash = record.hash;
      }
    }
    return tampered;
  }

  private loadSnapshot(): void {
    if (this.storagePath == null || !existsSync(this.storagePath)) {
      return;
    }
    const snapshot = parseSnapshot(readFileSync(this.storagePath, "utf8"));
    for (const record of snapshot.records) {
      this.records.set(record.frameworkId, [...(this.records.get(record.frameworkId) ?? []), record]);
    }
    for (const scheduled of snapshot.scheduledCollections) {
      this.scheduledCollections.set(scheduled.scheduleId, scheduled);
    }
    for (const [frameworkId, hash] of Object.entries(snapshot.lastHashByFramework)) {
      this.lastHashByFramework.set(frameworkId, hash);
    }
  }

  private persistSnapshot(): void {
    if (this.storagePath == null) {
      return;
    }
    mkdirSync(dirname(this.storagePath), { recursive: true });
    const snapshot: ComplianceEvidenceCollectorSnapshot = {
      schemaVersion: 1,
      records: [...this.records.values()].flatMap((items) => items),
      scheduledCollections: [...this.scheduledCollections.values()],
      lastHashByFramework: Object.fromEntries(this.lastHashByFramework.entries()),
    };
    writeFileSync(this.storagePath, JSON.stringify(snapshot, null, 2));
  }
}

function parseSnapshot(raw: string): ComplianceEvidenceCollectorSnapshot {
  const parsed = JSON.parse(raw) as Partial<ComplianceEvidenceCollectorSnapshot> | null;
  if (parsed == null || parsed.schemaVersion !== 1 || !Array.isArray(parsed.records) || !Array.isArray(parsed.scheduledCollections)) {
    throw new Error("compliance_evidence.invalid_snapshot");
  }
  return {
    schemaVersion: 1,
    records: parsed.records,
    scheduledCollections: parsed.scheduledCollections,
    lastHashByFramework: parsed.lastHashByFramework ?? {},
  };
}

function computeNextRunTime(fromIso: string, schedule: EvidenceCollectionSchedule): string {
  const nowMs = Date.parse(fromIso);
  switch (schedule.type) {
    case "periodic":
      return new Date(nowMs + schedule.intervalMinutes * 60_000).toISOString();
    case "quarterly":
      const quarterMs = 90 * 24 * 60 * 60 * 1000;
      return new Date(nowMs + quarterMs).toISOString();
    case "continuous":
      return new Date(nowMs + 60 * 1000).toISOString();
    case "on_demand":
    default:
      return fromIso;
  }
}
