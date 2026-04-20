export interface ExplanationEvidence {
  readonly evidenceId: string;
  readonly category: string;
}

export function collectExplanationEvidenceIds(items: readonly ExplanationEvidence[]): string[] {
  return items.map((item) => item.evidenceId);
}
