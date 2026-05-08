export interface EvidenceReference {
  readonly evidenceId: string;
  readonly evidenceType: string;
  readonly controlId?: string;
  readonly controlStatus?: "pass" | "fail" | "partial" | "not_applicable";
  readonly freshnessHours?: number;
  readonly trustScore?: number;
  readonly tamperProof?: boolean;
}

export interface EvidenceCoverageSummary {
  readonly coverageRatio: number;
  readonly coveredTypes: readonly string[];
  readonly missingTypes: readonly string[];
}

export interface ControlPointCoverage {
  readonly controlId: string;
  readonly status: "pass" | "fail" | "partial" | "not_applicable";
  readonly evidenceIds: readonly string[];
}

export interface EvidenceQualitySummary {
  readonly completenessScore: number;
  readonly freshnessScore: number;
  readonly trustworthinessScore: number;
  readonly tamperProofScore: number;
  readonly overallScore: number;
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

export function mapEvidenceByControlPoint(items: readonly EvidenceReference[]): Record<string, ControlPointCoverage> {
  const grouped = new Map<string, EvidenceReference[]>();
  for (const item of items) {
    if (!item.controlId) {
      continue;
    }
    grouped.set(item.controlId, [...(grouped.get(item.controlId) ?? []), item]);
  }
  const result: Record<string, ControlPointCoverage> = {};
  for (const [controlId, evidenceItems] of grouped.entries()) {
    const statuses = new Set(evidenceItems.map((item) => item.controlStatus ?? "pass"));
    const status: ControlPointCoverage["status"] =
      statuses.has("fail") ? "fail"
        : statuses.has("partial") ? "partial"
          : statuses.has("pass") ? "pass"
            : "not_applicable";
    result[controlId] = {
      controlId,
      status,
      evidenceIds: evidenceItems.map((item) => item.evidenceId),
    };
  }
  return result;
}

export class EvidenceMapperService {
  public map(items: readonly EvidenceReference[]): Record<string, string[]> {
    return mapEvidenceByType(items);
  }

  public mapControlPoints(items: readonly EvidenceReference[]): Record<string, ControlPointCoverage> {
    return mapEvidenceByControlPoint(items);
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

  public summarizeQuality(
    items: readonly EvidenceReference[],
    requiredTypes: readonly string[],
  ): EvidenceQualitySummary {
    const coverage = this.summarizeCoverage(items, requiredTypes);
    const completenessScore = coverage.coverageRatio;
    const freshnessValues = items
      .map((item) => item.freshnessHours)
      .filter((value): value is number => typeof value === "number")
      .map((hours) => hours <= 24 ? 1 : hours <= 72 ? 0.75 : hours <= 168 ? 0.5 : 0.25);
    const trustValues = items
      .map((item) => item.trustScore)
      .filter((value): value is number => typeof value === "number")
      .map((value) => Math.max(0, Math.min(1, value)));
    const tamperValues = items.map((item) => item.tamperProof === false ? 0 : item.tamperProof === true ? 1 : 0.5);
    const freshnessScore = averageOrDefault(freshnessValues, 0.5);
    const trustworthinessScore = averageOrDefault(trustValues, 0.5);
    const tamperProofScore = averageOrDefault(tamperValues, 0.5);
    const overallScore = Number((
      (completenessScore * 0.4)
      + (freshnessScore * 0.2)
      + (trustworthinessScore * 0.2)
      + (tamperProofScore * 0.2)
    ).toFixed(2));
    return {
      completenessScore: Number(completenessScore.toFixed(2)),
      freshnessScore: Number(freshnessScore.toFixed(2)),
      trustworthinessScore: Number(trustworthinessScore.toFixed(2)),
      tamperProofScore: Number(tamperProofScore.toFixed(2)),
      overallScore,
    };
  }
}

function averageOrDefault(values: readonly number[], fallback: number): number {
  return values.length === 0 ? fallback : values.reduce((sum, value) => sum + value, 0) / values.length;
}
