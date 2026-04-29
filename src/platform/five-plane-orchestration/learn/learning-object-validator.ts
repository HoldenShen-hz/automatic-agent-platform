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
    case "model_retraining":
      return 0.8;
    case "dataset_gap":
      return 0.8;
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

  private checkHoldoutDedup(_obj: LearningObject): boolean {
    // TODO: implement against holdout dataset
    return true;
  }

  private checkContamination(_obj: LearningObject): boolean {
    // TODO: implement cross-contamination check
    return true;
  }

  private checkDiversity(_obj: LearningObject): boolean {
    // TODO: implement diversity check against existing objects
    return true;
  }

  public validateMany(inputs: readonly LearningObject[]): LearningObject[] {
    return inputs
      .map((input) => this.validate(input))
      .filter((result) => result.valid)
      .map((result) => result.learningObject);
  }
}
