import { newId, nowIso } from "../../platform/contracts/types/ids.js";

export interface ComplianceEvidenceRecord {
  readonly evidenceId: string;
  readonly frameworkId: string;
  readonly controlId: string;
  readonly source: string;
  readonly artifactRef: string;
  readonly collectedAt: string;
}

export class ComplianceEvidenceCollector {
  private readonly records = new Map<string, ComplianceEvidenceRecord[]>();

  public collect(
    input: Omit<ComplianceEvidenceRecord, "evidenceId" | "collectedAt"> & { collectedAt?: string },
  ): ComplianceEvidenceRecord {
    const record: ComplianceEvidenceRecord = {
      ...input,
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
