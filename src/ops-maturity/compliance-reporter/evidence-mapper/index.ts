export interface EvidenceReference {
  readonly evidenceId: string;
  readonly evidenceType: string;
}

export interface EvidenceCoverageSummary {
  readonly coverageRatio: number;
  readonly coveredTypes: readonly string[];
  readonly missingTypes: readonly string[];
}

export function mapEvidenceByType(items: readonly EvidenceReference[]): Record<string, string[]> {
  return items.reduce<Record<string, string[]>>((acc, item) => {
    acc[item.evidenceType] = [...(acc[item.evidenceType] ?? []), item.evidenceId];
    return acc;
  }, {});
}

export function findMissingEvidenceTypes(
  items: readonly EvidenceReference[],
  requiredTypes: readonly string[],
): string[] {
  const mapped = mapEvidenceByType(items);
  return requiredTypes.filter((type) => (mapped[type] ?? []).length === 0);
}

export class EvidenceMapperService {
  public map(items: readonly EvidenceReference[]): Record<string, string[]> {
    return mapEvidenceByType(items);
  }

  public summarizeCoverage(
    items: readonly EvidenceReference[],
    requiredTypes: readonly string[],
  ): EvidenceCoverageSummary {
    const mapped = mapEvidenceByType(items);
    const coveredTypes = requiredTypes.filter((type) => (mapped[type] ?? []).length > 0);
    const missingTypes = requiredTypes.filter((type) => (mapped[type] ?? []).length === 0);
    return {
      coverageRatio: requiredTypes.length === 0
        ? 1
        : Number((coveredTypes.length / requiredTypes.length).toFixed(2)),
      coveredTypes,
      missingTypes,
    };
  }
}
