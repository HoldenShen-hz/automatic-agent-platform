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
          promotionStatus: "draft",
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
          promotionStatus: "draft",
        },
      };
    }

    return {
      valid: true,
      reasonCode: "learning.validated",
      learningObject: {
        ...learningObject,
        validatedBy: learningObject.validatedBy === "none" ? "evidence" : learningObject.validatedBy,
        promotionStatus: learningObject.promotionStatus === "draft" ? "validated" : learningObject.promotionStatus,
      },
    };
  }

  public validateMany(inputs: readonly LearningObject[]): LearningObject[] {
    return inputs
      .map((input) => this.validate(input))
      .filter((result) => result.valid)
      .map((result) => result.learningObject);
  }
}
