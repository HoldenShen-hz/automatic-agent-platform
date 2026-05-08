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

export class ComplianceEvidenceCollector {
  private readonly records = new Map<string, ComplianceEvidenceRecord[]>();

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
