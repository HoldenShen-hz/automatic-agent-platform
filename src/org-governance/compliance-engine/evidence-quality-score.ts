import { nowIso } from "../../platform/contracts/types/ids.js";

/**
 * R9-38: EvidenceQualityScore - measures the quality and completeness of compliance evidence
 */
export interface EvidenceQualityScore {
  readonly evidenceId: string;
  readonly frameworkId: string;
  readonly controlId: string;
  readonly score: number; // 0-100
  readonly dimensions: EvidenceQualityDimensions;
  readonly calculatedAt: string;
  readonly expiresAt: string;
}

export interface EvidenceQualityDimensions {
  /** Completeness: all required fields present */
  readonly completeness: number;
  /** Freshness: evidence is recent enough */
  readonly freshness: number;
  /** Authenticity: evidence source is trusted */
  readonly authenticity: number;
  /** Relevance: evidence directly addresses the control */
  readonly relevance: number;
  /** Chain of custody: audit trail is intact */
  readonly chainOfCustody: number;
}

/**
 * R9-38: EvidenceQualityScorer - calculates quality scores for compliance evidence
 */
export class EvidenceQualityScorer {
  private readonly freshnessThresholdDays: number;

  public constructor(freshnessThresholdDays: number = 90) {
    this.freshnessThresholdDays = freshnessThresholdDays;
  }

  /**
   * Calculate quality score for a single evidence record
   */
  public scoreEvidence(input: {
    readonly evidenceId: string;
    readonly frameworkId: string;
    readonly controlId: string;
    readonly collectedAt: string;
    readonly hasArtifactRef: boolean;
    readonly hasContent: boolean;
    readonly sourceSystem?: string;
    readonly timestamp?: string;
    readonly collectedBy?: string;
    readonly relevanceScore?: number;
  }): EvidenceQualityScore {
    const dimensions = this.calculateDimensions(input);
    const score = this.computeOverallScore(dimensions);

    return {
      evidenceId: input.evidenceId,
      frameworkId: input.frameworkId,
      controlId: input.controlId,
      score,
      dimensions,
      calculatedAt: nowIso(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };
  }

  private calculateDimensions(input: {
    readonly collectedAt: string;
    readonly hasArtifactRef: boolean;
    readonly hasContent: boolean;
    readonly sourceSystem?: string;
    readonly timestamp?: string;
    readonly collectedBy?: string;
    readonly relevanceScore?: number;
  }): EvidenceQualityDimensions {
    // Completeness: presence of key fields
    const completeness = this.calculateCompleteness(input);

    // Freshness: how recent is the evidence
    const freshness = this.calculateFreshness(input.collectedAt);

    // Authenticity: trusted sources score higher
    const authenticity = this.calculateAuthenticity(input.sourceSystem, input.collectedBy);

    // Relevance: direct evidence of control
    const relevance = input.relevanceScore ?? 0.8;

    // Chain of custody: audit trail intact
    const chainOfCustody = this.calculateChainOfCustody(input.timestamp, input.collectedBy);

    return { completeness, freshness, authenticity, relevance, chainOfCustody };
  }

  private calculateCompleteness(input: {
    readonly hasArtifactRef: boolean;
    readonly hasContent: boolean;
    readonly sourceSystem?: string;
    readonly timestamp?: string;
    readonly collectedBy?: string;
  }): number {
    let score = 0;
    if (input.hasArtifactRef) score += 20;
    if (input.hasContent) score += 20;
    if (input.sourceSystem != null) score += 20;
    if (input.timestamp != null) score += 20;
    if (input.collectedBy != null) score += 20;
    return score;
  }

  private calculateFreshness(collectedAt: string): number {
    const ageMs = Date.now() - new Date(collectedAt).getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    if (ageDays <= 30) return 100;
    if (ageDays <= this.freshnessThresholdDays) {
      return Math.max(50, 100 - ((ageDays - 30) / (this.freshnessThresholdDays - 30)) * 50);
    }
    return Math.max(0, 50 - ((ageDays - this.freshnessThresholdDays) / 30) * 50);
  }

  private calculateAuthenticity(sourceSystem?: string, collectedBy?: string): number {
    const trustedSources = ["automated_pipeline", "api_dashboard", "soc2_certified", "iso_certified"];
    if (sourceSystem != null && trustedSources.some((s) => sourceSystem.toLowerCase().includes(s))) {
      return 100;
    }
    if (collectedBy != null) {
      return collectedBy === "automated_system" ? 90 : 70;
    }
    return 50;
  }

  private calculateChainOfCustody(timestamp?: string, collectedBy?: string): number {
    if (timestamp != null && collectedBy != null) {
      return 100;
    }
    if (timestamp != null || collectedBy != null) {
      return 70;
    }
    return 30;
  }

  private computeOverallScore(dimensions: EvidenceQualityDimensions): number {
    // Weighted average of dimensions
    const weights = {
      completeness: 0.25,
      freshness: 0.25,
      authenticity: 0.2,
      relevance: 0.15,
      chainOfCustody: 0.15,
    };
    return Math.round(
      dimensions.completeness * weights.completeness
      + dimensions.freshness * weights.freshness
      + dimensions.authenticity * weights.authenticity
      + dimensions.relevance * weights.relevance
      + dimensions.chainOfCustody * weights.chainOfCustody,
    );
  }
}
