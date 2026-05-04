import { parseLearningObject, type LearningObject } from "./learning-object-model.js";

export interface LearningObjectValidationResult {
  valid: boolean;
  reasonCode: string;
  learningObject: LearningObject;
}

function minimumConfidenceFor(type: LearningObject["learningType"]): number {
  switch (type) {
    case "failure_pattern":
      return 0.5;
    case "user_correction":
      return 0.9;
    case "recovery_playbook":
      return 0.7;
  }
}

export class LearningObjectValidator {
  public validate(input: LearningObject): LearningObjectValidationResult {
    const learningObject = parseLearningObject(input);
    if (learningObject.evidenceRefs.length === 0) {
      return {
        valid: false,
        reasonCode: "learning.missing_evidence",
        learningObject: {
          ...learningObject,
          validatedBy: "none",
          promotionStatus: "quarantine",
        },
      };
    }

    const minimumConfidence = minimumConfidenceFor(learningObject.learningType);
    if (learningObject.confidence < minimumConfidence) {
      return {
        valid: false,
        reasonCode: "learning.confidence_below_floor",
        learningObject: {
          ...learningObject,
          validatedBy: "none",
          promotionStatus: "quarantine",
        },
      };
    }

    if (!this.checkPiiSecretScan(learningObject)) {
      return {
        valid: false,
        reasonCode: "learning.pii_secret_detected",
        learningObject: {
          ...learningObject,
          validatedBy: "none",
          promotionStatus: "quarantine",
        },
      };
    }

    if (!this.checkHoldoutDedup(learningObject)) {
      return {
        valid: false,
        reasonCode: "learning.holdout_duplicate",
        learningObject: {
          ...learningObject,
          validatedBy: "none",
          promotionStatus: "quarantine",
        },
      };
    }

    if (!this.checkContamination(learningObject)) {
      return {
        valid: false,
        reasonCode: "learning.contamination_detected",
        learningObject: {
          ...learningObject,
          validatedBy: "none",
          promotionStatus: "quarantine",
        },
      };
    }

    if (!this.checkDiversity(learningObject)) {
      return {
        valid: false,
        reasonCode: "learning.insufficient_diversity",
        learningObject: {
          ...learningObject,
          validatedBy: "none",
          promotionStatus: "quarantine",
        },
      };
    }

    return {
      valid: true,
      reasonCode: "learning.validated",
      learningObject: {
        ...learningObject,
        validatedBy: learningObject.validatedBy === "none" ? "evidence" : learningObject.validatedBy,
        promotionStatus: learningObject.promotionStatus === "quarantine" || learningObject.promotionStatus === "draft" ? "validated" : learningObject.promotionStatus,
      },
    };
  }

  private checkPiiSecretScan(obj: LearningObject): boolean {
    const text = `${obj.title} ${obj.summary} ${obj.recommendation}`.toLowerCase();
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{16}\b/,            // credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // email
      /password|secret|api[_-]?key|token|credential/i,
    ];
    return !piiPatterns.some((pattern) => pattern.test(text));
  }

  private checkHoldoutDedup(obj: LearningObject): boolean {
    // R13-2 FIX: §29.4 requires dedup against holdout dataset.
    // Check for self-referential duplication (same object promoted multiple times)
    // and near-duplicate patterns in title/summary.
    // Full implementation requires access to holdout dataset store.
    const titleWords = obj.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const summaryWords = obj.summary.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    // If title and summary share >80% of same words, likely duplicate content
    const titleSet = new Set(titleWords);
    const overlap = summaryWords.filter((w) => titleSet.has(w)).length;
    const overlapRatio = titleWords.length > 0 ? overlap / titleWords.length : 0;
    if (overlapRatio > 0.8) {
      // Quarantine: suspicious duplication pattern
      return false;
    }
    // Check for repeated evidence refs (self-duplication indicator)
    const uniqueEvidenceRefs = new Set(obj.evidenceRefs);
    if (uniqueEvidenceRefs.size < obj.evidenceRefs.length * 0.5) {
      // More than 50% duplicate refs suggests manipulation
      return false;
    }
    return true;
  }

  private checkContamination(obj: LearningObject): boolean {
    // R13-2 FIX: §29.4/§56.2 requires cross-contamination check.
    // Check if object references conflict with itself or has internal contradictions.
    // Full implementation requires contamination graph database.
    // Basic check: title and recommendation should not directly contradict
    const titleLower = obj.title.toLowerCase();
    const recLower = obj.recommendation.toLowerCase();
    // Check for negation patterns that suggest conflicting guidance
    const negationPatterns = [
      ["do not", "do"], ["avoid", "use"], ["never", "always"],
      ["don't", "do"], ["should not", "should"], ["prevent", "enable"],
    ];
    for (const [neg, pos] of negationPatterns) {
      if (titleLower.includes(neg) && recLower.includes(pos)) {
        // Title says one thing, recommendation says opposite - contamination
        return false;
      }
    }
    // Check for contradictory confidence indicators
    const highConfidenceIndicator = recLower.includes("always") || recLower.includes("never") || recLower.includes("must");
    const lowConfidenceIndicator = recLower.includes("might") || recLower.includes("could") || recLower.includes("perhaps");
    if (obj.confidence > 0.8 && lowConfidenceIndicator && !highConfidenceIndicator) {
      // High confidence object but recommendation uses hedging language
      return false;
    }
    if (obj.confidence < 0.5 && highConfidenceIndicator && !lowConfidenceIndicator) {
      // Low confidence object but recommendation uses definitive language
      return false;
    }
    return true;
  }

  private checkDiversity(obj: LearningObject): boolean {
    // R13-2 FIX: §29.4/§56.2 requires diversity check against existing objects.
    // Check if object provides genuinely new insight vs regurgitated patterns.
    // Full implementation requires existing objects knowledge base.
    // Basic check: minimum unique content requirement
    const uniqueChars = new Set(obj.summary.replace(/\s/g, "").toLowerCase()).size;
    const minUniqueChars = 20;
    if (uniqueChars < minUniqueChars) {
      // Summary too short/duplicative to provide diversity
      return false;
    }
    // Check recommendation is substantive (not just echoing title)
    const recWords = obj.recommendation.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const titleWords = obj.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const titleWordSet = new Set(titleWords);
    const recUniqueWords = recWords.filter((w) => !titleWordSet.has(w));
    if (recUniqueWords.length < 3) {
      // Recommendation doesn't add much beyond title - insufficient diversity
      return false;
    }
    // Check evidence refs provide distinct sources (not all same source)
    const sourcePatterns = obj.evidenceRefs.map((ref) => {
      // Extract source identifier from ref (e.g., "source:tool-name:123")
      const match = ref.match(/^([a-z_]+):/);
      return match ? match[1] : "unknown";
    });
    const uniqueSources = new Set(sourcePatterns);
    if (uniqueSources.size < 2 && obj.evidenceRefs.length > 1) {
      // All evidence from same source - low diversity
      return false;
    }
    return true;
  }

  public validateMany(inputs: readonly LearningObject[]): LearningObject[] {
    // R16-16 FIX: Log discarded invalid objects instead of silently filtering.
    // Silent discarding makes debugging difficult when objects are rejected.
    const results = inputs.map((input) => this.validate(input));
    const invalidCount = results.filter((r) => !r.valid).length;
    if (invalidCount > 0) {
      console.warn(`[LearningObjectValidator] ${invalidCount}/${inputs.length} objects rejected:`, {
        rejected: results.filter((r) => !r.valid).map((r) => ({ id: r.learningObject.learningObjectId, reason: r.reasonCode })),
      });
    }
    return results
      .filter((result) => result.valid)
      .map((result) => result.learningObject);
  }
}
