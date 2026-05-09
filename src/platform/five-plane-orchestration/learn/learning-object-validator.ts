import {
  normalizeLearningObjectPromotionStatus,
  parseLearningObject,
  type LearningObject,
} from "./learning-object-model.js";

export interface PiiScanResult {
  containsPii: boolean;
  piiTypes: string[];
  containsSecrets: boolean;
  secretTypes: string[];
}

export interface DiversityCheckResult {
  isDiverse: boolean;
  reasonCode: string;
}

export interface LearningObjectValidationResult {
  valid: boolean;
  reasonCode: string;
  learningObject: LearningObject;
  warnings?: string[];
}

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  /\b\d{16}\b/, // Credit card
  /password\s*[=:]\s*\S+/i,
  /api[_-]?key\s*[=:]\s*\S+/i,
  /secret\s*[=:]\s*\S+/i,
  /token\s*[=:]\s*\S+/i,
];

const SECRET_KEYWORDS = [
  "password", "passwd", "secret", "token", "api_key", "apikey",
  "auth", "credential", "private_key", "access_token", "bearer",
];

function scanForPiiAndSecrets(text: string): PiiScanResult {
  const piiTypes: string[] = [];
  const secretTypes: string[] = [];

  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) piiTypes.push("ssn");
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text)) piiTypes.push("email");
  if (/\b\d{16}\b/.test(text)) piiTypes.push("credit_card");

  const lowerText = text.toLowerCase();
  for (const keyword of SECRET_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      secretTypes.push(keyword);
    }
  }

  return {
    containsPii: piiTypes.length > 0,
    piiTypes,
    containsSecrets: secretTypes.length > 0,
    secretTypes,
  };
}

function checkDiversity(learningObjects: readonly LearningObject[], current: LearningObject): DiversityCheckResult {
  // Check if we already have a similar learning object (contamination/dedup)
  for (const existing of learningObjects) {
    if (existing.learningObjectId === current.learningObjectId) continue;
    if (existing.learningType !== current.learningType) continue;

    // Check for duplicate title or very similar summary (holdout dedup)
    const titleSimilarity = similarity(current.title, existing.title);
    if (titleSimilarity > 0.85) {
      return {
        isDiverse: false,
        reasonCode: "learning.dedup_similar_title",
      };
    }

    const summarySimilarity = similarity(current.summary, existing.summary);
    if (summarySimilarity > 0.80) {
      return {
        isDiverse: false,
        reasonCode: "learning.dedup_similar_summary",
      };
    }
  }

  return { isDiverse: true, reasonCode: "learning.diverse" };
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const aWords = new Set(a.toLowerCase().split(/\s+/));
  const bWords = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...aWords].filter(w => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;

  return union > 0 ? intersection / union : 0;
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
  private knownObjects: LearningObject[] = [];

  public validate(input: LearningObject): LearningObjectValidationResult {
    const learningObject = parseLearningObject(input);
    const warnings: string[] = [];
    const normalizedPromotionStatus = normalizeLearningObjectPromotionStatus(learningObject.promotionStatus);
    const candidate: LearningObject = {
      ...learningObject,
      promotionStatus:
        normalizedPromotionStatus === "draft" || normalizedPromotionStatus === "untrusted"
          ? "validating"
          : normalizedPromotionStatus,
    };

    // R13-02: PII scan
    const piiResult = scanForPiiAndSecrets(candidate.summary + " " + candidate.recommendation);
    if (piiResult.containsPii) {
      return {
        valid: false,
        reasonCode: "learning.pii_detected",
        learningObject: {
          ...candidate,
          validatedBy: "none",
          promotionStatus: "quarantined",
        },
        warnings: [`PII detected: ${piiResult.piiTypes.join(", ")}`],
      };
    }

    // R13-02: Secret scan
    if (piiResult.containsSecrets) {
      return {
        valid: false,
        reasonCode: "learning.secret_detected",
        learningObject: {
          ...candidate,
          validatedBy: "none",
          promotionStatus: "quarantined",
        },
        warnings: [`Secrets detected: ${piiResult.secretTypes.join(", ")}`],
      };
    }

    // R13-02: Holdout dedup / contamination check
    const diversityResult = checkDiversity(this.knownObjects, candidate);
    if (!diversityResult.isDiverse) {
      return {
        valid: false,
        reasonCode: diversityResult.reasonCode,
        learningObject: {
          ...candidate,
          validatedBy: "none",
          promotionStatus: "quarantined",
        },
        warnings: ["Object failed diversity check - possible contamination or duplication"],
      };
    }

    // R13-02: Diversity check (broader ecosystem diversity)
    if (candidate.evidenceRefs.length === 0) {
      return {
        valid: false,
        reasonCode: "learning.missing_evidence",
        learningObject: {
          ...candidate,
          validatedBy: "none",
          promotionStatus: "quarantined",
        },
      };
    }

    const minimumConfidence = minimumConfidenceFor(candidate.learningType);
    if (candidate.confidence < minimumConfidence) {
      return {
        valid: false,
        reasonCode: "learning.confidence_below_floor",
        learningObject: {
          ...candidate,
          validatedBy: "none",
          promotionStatus: "quarantined",
        },
      };
    }

    return {
      valid: true,
      reasonCode: "learning.validated",
      learningObject: {
        ...candidate,
        validatedBy: candidate.validatedBy === "none" ? "evidence" : candidate.validatedBy,
        promotionStatus: candidate.promotionStatus === "draft"
          || candidate.promotionStatus === "untrusted"
          || candidate.promotionStatus === "validating"
          || candidate.promotionStatus === "quarantined"
          ? "validated"
          : candidate.promotionStatus,
      },
      warnings: warnings.length > 0 ? warnings : [],
    };
  }

  public validateMany(inputs: readonly LearningObject[]): LearningObject[] {
    // Update known objects before validation
    this.knownObjects = [...inputs];
    // R13-01 fix: Return all objects (including quarantined), not just valid ones.
    // Quarantine status must be preserved through validateMany per §29.4.
    return inputs
      .map((input) => this.validate(input))
      .map((result) => result.learningObject);
  }
}
