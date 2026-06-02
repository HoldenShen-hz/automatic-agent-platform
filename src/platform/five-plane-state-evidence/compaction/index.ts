export interface CompactionEvidenceRecord {
  readonly compactionId: string;
  readonly sourceRefs: readonly string[];
  readonly artifactRef: string;
  readonly retentionPolicyRef: string;
  readonly reversible: boolean;
}

export function createCompactionEvidenceRecord(record: CompactionEvidenceRecord): CompactionEvidenceRecord {
  return Object.freeze({
    ...record,
    sourceRefs: [...record.sourceRefs],
  });
}

export class CompactionEvidenceService {
  private readonly records = new Map<string, CompactionEvidenceRecord>();

  public append(record: CompactionEvidenceRecord): CompactionEvidenceRecord {
    const normalized = createCompactionEvidenceRecord(record);
    this.records.set(normalized.compactionId, normalized);
    return normalized;
  }

  public listByRetentionPolicy(retentionPolicyRef: string): CompactionEvidenceRecord[] {
    return [...this.records.values()].filter((record) => record.retentionPolicyRef === retentionPolicyRef);
  }
}
