export interface EvidenceReference {
  readonly evidenceId: string;
  readonly evidenceType: string;
  readonly controlId?: string;
  // §66.2: Evidence quality fields for evidenceQualityScore
  readonly freshness?: string;
  readonly trustworthiness?: "high" | "medium" | "low";
  readonly tamperProof?: "cryptographic" | "signed" | "none";
  readonly owner?: string;
  readonly exception?: string;
}

export interface EvidenceCoverageSummary {
  readonly coverageRatio: number;
  readonly coveredTypes: readonly string[];
  readonly missingTypes: readonly string[];
}

/**
 * Control point mapping with pass/fail/partial/not_applicable status.
 * Per §66.2, ControlMapper must map evidence to control points with status.
 */
export interface ControlMapping {
  readonly controlId: string;
  readonly status: "pass" | "fail" | "partial" | "not_applicable";
  readonly evidenceIds: readonly string[];
  readonly coverageRatio: number;
  readonly findings?: readonly string[];
}

/**
 * Gap analysis result with remediation, owner, and deadline.
 * Per §66.2, GapAnalyzer must provide remediation guidance, owner assignment, and deadline.
 */
export interface GapAnalysisResult {
  readonly controlId: string;
  readonly gapSeverity: "low" | "medium" | "high" | "critical";
  readonly missingEvidence: readonly string[];
  readonly recommendation: string;
  readonly remediation: string;
  readonly owner: string | null;
  readonly deadline: string | null;
}

/**
 * Maps evidence by type (legacy function for backward compatibility).
 */
export function mapEvidenceByType(items: readonly EvidenceReference[]): Record<string, string[]> {
  return items.reduce<Record<string, string[]>>((acc, item) => {
    acc[item.evidenceType] = [...(acc[item.evidenceType] ?? []), item.evidenceId];
    return acc;
  }, {});
}

/**
 * Maps evidence by control point with pass/fail/partial/not_applicable status.
 * Per §66.2, ControlMapper must provide control point mapping with status.
 */
export function mapEvidenceByControl(items: readonly EvidenceReference[]): ControlMapping[] {
  const controlMap = new Map<string, ControlMapping>();
  const notApplicableIds: string[] = [];

  for (const item of items) {
    if (!item.controlId) {
      // §66.2: Evidence without controlId is marked as not_applicable
      notApplicableIds.push(item.evidenceId);
      continue;
    }

    const existing = controlMap.get(item.controlId);
    if (existing) {
      controlMap.set(item.controlId, {
        ...existing,
        evidenceIds: [...existing.evidenceIds, item.evidenceId],
        coverageRatio: Math.min(1, existing.evidenceIds.length + 1 / 3), // Simplified coverage
      });
    } else {
      controlMap.set(item.controlId, {
        controlId: item.controlId,
        status: "pass",
        evidenceIds: [item.evidenceId],
        coverageRatio: 0.33,
      });
    }
  }

  // Determine status based on coverage
  controlMap.forEach((mapping, controlId) => {
    const status = mapping.coverageRatio >= 1
      ? "pass"
      : mapping.coverageRatio >= 0.5
        ? "partial"
        : "fail";
    controlMap.set(controlId, { ...mapping, status });
  });

  // §66.2: Add not_applicable control mapping if there are items without controlId
  if (notApplicableIds.length > 0) {
    controlMap.set("_not_applicable", {
      controlId: "_not_applicable",
      status: "not_applicable",
      evidenceIds: notApplicableIds,
      coverageRatio: 0,
    });
  }

  return Array.from(controlMap.values());
}

/**
 * Analyzes gaps with remediation, owner, and deadline assignment.
 * Per §66.2, GapAnalyzer must provide remediation guidance, owner, and deadline.
 */
export function analyzeGaps(
  controls: readonly string[],
  evidenceMap: Readonly<Record<string, readonly string[]>>,
  ownerMap?: Readonly<Record<string, string>>,
  deadlineMap?: Readonly<Record<string, string>>,
): GapAnalysisResult[] {
  const results: GapAnalysisResult[] = [];
  for (const controlId of controls) {
    const evidenceTypes = evidenceMap[controlId] ?? [];
    const missingEvidence = evidenceTypes.length === 0 ? [controlId] : [];
    const gapSeverity: GapAnalysisResult["gapSeverity"] =
      missingEvidence.length > 0 ? "high" : "low";
    results.push({
      controlId,
      gapSeverity,
      missingEvidence,
      recommendation: missingEvidence.length > 0
        ? `Missing evidence for control ${controlId}`
        : "Control satisfied",
      remediation: missingEvidence.length > 0
        ? `Obtain and provide evidence for ${controlId}`
        : "No remediation needed",
      owner: ownerMap?.[controlId] ?? null,
      deadline: deadlineMap?.[controlId] ?? null,
    });
  }
  return results;
}

export function findMissingEvidenceTypes(
  items: readonly EvidenceReference[],
  requiredTypes: readonly string[],
): string[] {
  const mapped = mapEvidenceByType(items);
  return requiredTypes.filter((type) => (mapped[type] ?? []).length === 0);
}

/**
 * Computes evidence quality score based on coverage, freshness, trustworthiness, and tamper-proof.
 * Per §66.2, evidenceQualityScore must consider freshness/trustworthiness/tamper-proof.
 */
export function computeEvidenceQualityScore(
  items: readonly EvidenceReference[],
  coverageRatio: number,
): number {
  if (items.length === 0) return 0;

  // Coverage component (40% weight)
  const coverageScore = coverageRatio * 0.4;

  // Freshness component (20% weight) - based on presence of freshness field
  const freshnessScore = items.some((item) => item.freshness) ? 0.2 : 0;

  // Trustworthiness component (20% weight)
  const trustworthinessScores: Record<string, number> = { high: 0.2, medium: 0.1, low: 0 };
  const trustworthinessScore = items.reduce<number>((sum, item) => {
    const score = item.trustworthiness ? trustworthinessScores[item.trustworthiness] ?? 0 : 0;
    return sum + score;
  }, 0) / items.length;

  // Tamper-proof component (20% weight)
  const tamperProofScores: Record<string, number> = { cryptographic: 0.2, signed: 0.1, none: 0 };
  const tamperProofScore = items.reduce<number>((sum, item) => {
    const score = item.tamperProof ? tamperProofScores[item.tamperProof] ?? 0 : 0;
    return sum + score;
  }, 0) / items.length;

  return Number(((coverageScore + freshnessScore + trustworthinessScore + tamperProofScore) * 100).toFixed(2));
}

export class EvidenceMapperService {
  public map(items: readonly EvidenceReference[]): Record<string, string[]> {
    return mapEvidenceByType(items);
  }

  /**
   * Maps evidence by control point with pass/fail/partial status.
   * Per §66.2, ControlMapper must provide control point mapping.
   */
  public mapByControl(items: readonly EvidenceReference[]): ControlMapping[] {
    return mapEvidenceByControl(items);
  }

  /**
   * Analyzes gaps with remediation, owner, and deadline.
   * Per §66.2, GapAnalyzer must provide remediation guidance, owner, and deadline.
   */
  public analyzeGaps(
    controls: readonly string[],
    evidenceMap: Readonly<Record<string, readonly string[]>>,
    ownerMap?: Readonly<Record<string, string>>,
    deadlineMap?: Readonly<Record<string, string>>,
  ): GapAnalysisResult[] {
    return analyzeGaps(controls, evidenceMap, ownerMap, deadlineMap);
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

  /**
   * Computes evidence quality score based on coverage, freshness, trustworthiness, and tamper-proof.
   * Per §66.2, evidenceQualityScore must consider freshness/trustworthiness/tamper-proof.
   */
  public computeQualityScore(items: readonly EvidenceReference[], coverageRatio: number): number {
    return computeEvidenceQualityScore(items, coverageRatio);
  }
}
