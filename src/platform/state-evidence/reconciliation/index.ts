export interface ReconciliationEvidenceRecord {
  readonly reconciliationId: string;
  readonly sourceRef: string;
  readonly observedState: unknown;
  readonly expectedState: unknown;
  readonly result: "matched" | "mismatched" | "missing" | "ambiguous";
  readonly evidenceRefs: readonly string[];
}

export function createReconciliationEvidenceRecord(
  record: ReconciliationEvidenceRecord,
): ReconciliationEvidenceRecord {
  return record;
}
