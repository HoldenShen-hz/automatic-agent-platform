export interface CompactionEvidenceRecord {
  readonly compactionId: string;
  readonly sourceRefs: readonly string[];
  readonly artifactRef: string;
  readonly retentionPolicyRef: string;
  readonly reversible: boolean;
}

export function createCompactionEvidenceRecord(record: CompactionEvidenceRecord): CompactionEvidenceRecord {
  return record;
}
