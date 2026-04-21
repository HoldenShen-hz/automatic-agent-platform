export interface EvidenceReference {
  readonly evidenceId: string;
  readonly evidenceType: string;
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
