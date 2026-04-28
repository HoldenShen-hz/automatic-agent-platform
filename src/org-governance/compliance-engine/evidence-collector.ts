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
}

type ComplianceEvidenceCollectInput =
  Omit<ComplianceEvidenceRecord, "evidenceId" | "collectedAt"> & { collectedAt?: string };

function normalizeEvidenceInput(input: ComplianceEvidenceCollectInput): Omit<ComplianceEvidenceRecord, "evidenceId" | "collectedAt"> {
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

export class ComplianceEvidenceCollector {
  private readonly records = new Map<string, ComplianceEvidenceRecord[]>();
  private readonly scheduledCollections = new Map<string, ScheduledEvidenceCollection>();

  public collect(
    input: ComplianceEvidenceCollectInput,
  ): ComplianceEvidenceRecord {
    const normalized = normalizeEvidenceInput(input);
    const record: ComplianceEvidenceRecord = {
      ...normalized,
      evidenceId: newId("compliance_evidence"),
      collectedAt: input.collectedAt ?? nowIso(),
    };
    this.records.set(record.frameworkId, [...(this.records.get(record.frameworkId) ?? []), record]);
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
    return true;
  }
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
