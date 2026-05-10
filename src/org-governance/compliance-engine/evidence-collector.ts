import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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
  readonly previousHash?: string;
  readonly hash?: string;
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

type ComplianceEvidenceCollectInput =
  Omit<ComplianceEvidenceRecord, "evidenceId" | "collectedAt" | "previousHash" | "hash">
  & { collectedAt?: string };

interface EvidenceCollectorSnapshot {
  readonly records: Record<string, ComplianceEvidenceRecord[]>;
  readonly schedules: EvidenceCollectionSchedule[];
}

function normalizeEvidenceInput(
  input: ComplianceEvidenceCollectInput,
): Omit<ComplianceEvidenceRecord, "evidenceId" | "collectedAt" | "previousHash" | "chainHash"> {
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
    this.records.set(record.frameworkId, [...existing, record]);
    this.persistSnapshot();
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
    this.persistSnapshot();
    return schedule;
  }

  public listScheduledCollections(): EvidenceCollectionSchedule[] {
    return [...this.schedules.values()];
  }

  public getDueCollections(referenceTime: string): EvidenceCollectionSchedule[] {
    return this.listScheduledCollections().filter((schedule) =>
      schedule.active && schedule.nextRunAt <= referenceTime,
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
    this.persistSnapshot();
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
        this.pendingCollections.set(frameworkId, timeout);
      }
    };

    const timeout = setTimeout(runCollection, schedule.intervalMs);
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
    mkdirSync(dirname(this.storagePath), { recursive: true });
    const snapshot: EvidenceCollectorSnapshot = {
      records: Object.fromEntries(
        [...this.records.entries()].map(([frameworkId, records]) => [frameworkId, records]),
      ),
      schedules: this.listScheduledCollections(),
    };
    writeFileSync(this.storagePath, JSON.stringify(snapshot, null, 2), "utf8");
  }
}
