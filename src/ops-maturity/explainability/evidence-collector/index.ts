export interface ExplanationEvidence {
  readonly evidenceId: string;
  readonly category: string;
  readonly sourceRef?: string;
  readonly excerpt?: string;
}

export function collectExplanationEvidenceIds(items: readonly ExplanationEvidence[]): string[] {
  return items.map((item) => item.evidenceId);
}

export interface ExplanationEvidenceBundle {
  readonly evidenceIds: readonly string[];
  readonly groupedByCategory: Readonly<Record<string, readonly ExplanationEvidence[]>>;
}

export function collectExplanationEvidence(items: readonly ExplanationEvidence[]): ExplanationEvidenceBundle {
  return {
    evidenceIds: collectExplanationEvidenceIds(items),
    groupedByCategory: items.reduce<Record<string, ExplanationEvidence[]>>((acc, item) => {
      acc[item.category] = [...(acc[item.category] ?? []), item];
      return acc;
    }, {}),
  };
}
