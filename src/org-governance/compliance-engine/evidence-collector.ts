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

/**
 * R5-39: ComplianceEvidenceCollector with periodic collection support
 * Adds scheduler/cycle/freshness enforcement for evidence collection
 */
export class ComplianceEvidenceCollector {
  private readonly records = new Map<string, ComplianceEvidenceRecord[]>();
  // R5-39: Track collection schedule and freshness
  private readonly collectionSchedule = new Map<string, { intervalMs: number; lastCollectedAt: string | null }>();
  private readonly pendingCollections = new Map<string, NodeJS.Timeout>();

  /**
   * R5-39: Configure periodic collection for a framework
   * @param frameworkId The framework to schedule collection for
   * @param intervalMs Collection interval in milliseconds
   */
  public scheduleCollection(frameworkId: string, intervalMs: number): void {
    this.collectionSchedule.set(frameworkId, {
      intervalMs,
      lastCollectedAt: null,
    });
  }

  /**
   * R5-39: Start periodic collection for a framework
   * @param frameworkId The framework to collect evidence for
   * @param collectorFn Function that returns evidence records to collect
   */
  public startPeriodicCollection(
    frameworkId: string,
    collectorFn: () => ComplianceEvidenceCollectInput[],
  ): void {
    const schedule = this.collectionSchedule.get(frameworkId);
    if (!schedule) {
      throw new Error(`compliance_collector.schedule_not_found:${frameworkId}`);
    }

    // Cancel any existing pending collection
    const existing = this.pendingCollections.get(frameworkId);
    if (existing) {
      clearTimeout(existing);
    }

    const runCollection = () => {
      const records = collectorFn();
      for (const input of records) {
        this.collect(input);
      }
      const updatedSchedule = this.collectionSchedule.get(frameworkId);
      if (updatedSchedule) {
        updatedSchedule.lastCollectedAt = nowIso();
      }
      // Schedule next collection
      const nextSchedule = this.collectionSchedule.get(frameworkId);
      if (nextSchedule) {
        const timeout = setTimeout(runCollection, nextSchedule.intervalMs);
        this.pendingCollections.set(frameworkId, timeout);
      }
    };

    const timeout = setTimeout(runCollection, schedule.intervalMs);
    this.pendingCollections.set(frameworkId, timeout);
  }

  /**
   * R5-39: Stop periodic collection for a framework
   */
  public stopPeriodicCollection(frameworkId: string): void {
    const existing = this.pendingCollections.get(frameworkId);
    if (existing) {
      clearTimeout(existing);
      this.pendingCollections.delete(frameworkId);
    }
  }

  /**
   * R5-39: Check freshness of collected evidence
   * @param frameworkId The framework to check
   * @param maxAgeMs Maximum acceptable age in milliseconds
   * @returns true if evidence is fresh (collected within maxAgeMs)
   */
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

  /**
   * R5-39: Get collection freshness info for a framework
   */
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
}
