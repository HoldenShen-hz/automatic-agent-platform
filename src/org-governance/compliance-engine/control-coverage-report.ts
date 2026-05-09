import { nowIso } from "../../platform/contracts/types/ids.js";

/**
 * R9-38: ControlCoverageReport - reports on the coverage of compliance controls
 */
export interface ControlCoverageReport {
  readonly reportId: string;
  readonly frameworkId: string;
  readonly generatedAt: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly summary: ControlCoverageSummary;
  readonly controls: readonly ControlCoverageDetail[];
  readonly gaps: readonly ControlGap[];
}

export interface ControlCoverageSummary {
  readonly totalControls: number;
  readonly coveredControls: number;
  readonly partialControls: number;
  readonly uncoveredControls: number;
  readonly coveragePercentage: number;
  readonly evidenceCount: number;
  readonly averageEvidenceQuality: number;
}

export interface ControlCoverageDetail {
  readonly controlId: string;
  readonly controlName: string;
  readonly category: string;
  readonly coverageStatus: "covered" | "partial" | "uncovered";
  readonly evidenceIds: readonly string[];
  readonly lastEvidenceCollectedAt: string | null;
  readonly evidenceQualityAverage: number | null;
  readonly notes: readonly string[];
}

export interface ControlGap {
  readonly controlId: string;
  readonly controlName: string;
  readonly gapSeverity: "critical" | "high" | "medium" | "low";
  readonly description: string;
  readonly remediationRecommendation: string;
  readonly estimatedEffortHours: number | null;
}

/**
 * R9-38: ControlCoverageAnalyzer - generates coverage reports for compliance frameworks
 */
export class ControlCoverageAnalyzer {
  public generateReport(input: {
    readonly frameworkId: string;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly controlDefinitions: ReadonlyArray<{
      readonly controlId: string;
      readonly controlName: string;
      readonly category: string;
      readonly requiredEvidenceTypes?: readonly string[];
    }>;
    readonly evidenceRecords: ReadonlyArray<{
      readonly evidenceId: string;
      readonly frameworkId: string;
      readonly controlId: string;
      readonly collectedAt: string;
      readonly source: string;
      readonly qualityScore?: number;
    }>;
  }): ControlCoverageReport {
    const gapList: ControlGap[] = [];
    const controlDetails: ControlCoverageDetail[] = [];

    for (const control of input.controlDefinitions) {
      const relevantEvidence = input.evidenceRecords.filter(
        (e) => e.frameworkId === input.frameworkId && e.controlId === control.controlId,
      );

      const evidenceQualityScores = relevantEvidence
        .map((e) => e.qualityScore)
        .filter((s): s is number => s != null);
      const avgQuality = evidenceQualityScores.length > 0
        ? evidenceQualityScores.reduce((a, b) => a + b, 0) / evidenceQualityScores.length
        : null;

      let coverageStatus: ControlCoverageDetail["coverageStatus"];
      if (relevantEvidence.length === 0) {
        coverageStatus = "uncovered";
        gapList.push({
          controlId: control.controlId,
          controlName: control.controlName,
          gapSeverity: "high",
          description: `No evidence collected for control ${control.controlId} in reporting period`,
          remediationRecommendation: "Collect evidence from relevant systems or processes",
          estimatedEffortHours: 4,
        });
      } else if (avgQuality != null && avgQuality < 50) {
        coverageStatus = "partial";
        gapList.push({
          controlId: control.controlId,
          controlName: control.controlName,
          gapSeverity: "medium",
          description: `Evidence quality below threshold for control ${control.controlId}`,
          remediationRecommendation: "Improve evidence collection process and chain of custody",
          estimatedEffortHours: 2,
        });
      } else {
        coverageStatus = "covered";
      }

      controlDetails.push({
        controlId: control.controlId,
        controlName: control.controlName,
        category: control.category,
        coverageStatus,
        evidenceIds: relevantEvidence.map((e) => e.evidenceId),
        lastEvidenceCollectedAt: relevantEvidence.length > 0
          ? [...relevantEvidence].sort(
              (a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime(),
            )[0]?.collectedAt ?? null
          : null,
        evidenceQualityAverage: avgQuality,
        notes: [],
      });
    }

    const totalControls = controlDetails.length;
    const coveredControls = controlDetails.filter((c) => c.coverageStatus === "covered").length;
    const partialControls = controlDetails.filter((c) => c.coverageStatus === "partial").length;
    const uncoveredControls = controlDetails.filter((c) => c.coverageStatus === "uncovered").length;

    const evidenceQualityScores = controlDetails
      .map((c) => c.evidenceQualityAverage)
      .filter((s): s is number => s != null);
    const avgEvidenceQuality = evidenceQualityScores.length > 0
      ? evidenceQualityScores.reduce((a, b) => a + b, 0) / evidenceQualityScores.length
      : 0;

    return {
      reportId: `control_coverage_${input.frameworkId}_${Date.now()}`,
      frameworkId: input.frameworkId,
      generatedAt: nowIso(),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      summary: {
        totalControls,
        coveredControls,
        partialControls,
        uncoveredControls,
        coveragePercentage: totalControls > 0 ? Math.round((coveredControls / totalControls) * 100) : 0,
        evidenceCount: input.evidenceRecords.length,
        averageEvidenceQuality: Math.round(avgEvidenceQuality),
      },
      controls: controlDetails,
      gaps: gapList,
    };
  }
}
