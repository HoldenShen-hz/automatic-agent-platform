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
  return Object.freeze({
    ...record,
    evidenceRefs: [...record.evidenceRefs],
  });
}

export class ReconciliationEvidenceService {
  private readonly records = new Map<string, ReconciliationEvidenceRecord>();

  public record(record: ReconciliationEvidenceRecord): ReconciliationEvidenceRecord {
    const normalized = createReconciliationEvidenceRecord(record);
    this.records.set(normalized.reconciliationId, normalized);
    return normalized;
  }

  public listMismatches(): ReconciliationEvidenceRecord[] {
    return [...this.records.values()].filter((record) => record.result === "mismatched" || record.result === "missing");
  }
}
