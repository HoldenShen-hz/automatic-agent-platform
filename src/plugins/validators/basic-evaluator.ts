import type { DomainValidatorPlugin } from "../../domains/registry/plugin-spi.js";

interface BasicValidationContract {
  requiredFields?: string[];
  fieldTypes?: Record<string, "string" | "number" | "boolean" | "array" | "object">;
  expectedOutcomeFields?: string[];
  highRiskFields?: string[];
  qualityThreshold?: number;
  requiresHumanReviewOnRisk?: boolean;
}

/** R11-14: Quality scoring weights configuration */
interface QualityScoringConfig {
  readonly completenessWeight: number;    // Weight for field completeness
  readonly typeAccuracyWeight: number;    // Weight for type accuracy
  readonly suggestionPenalty: number;      // Penalty per suggestion needed
}

/** R11-14: Quality evaluation result with scoring */
interface QualityEvaluationResult {
  readonly valid: boolean;
  readonly errors: Array<{ field: string; message: string; severity: "error" | "warning" }>;
  readonly suggestions: string[];
  readonly qualityScore: number;
  readonly qualityThreshold: number;
  readonly scoreBreakdown: {
    readonly completenessScore: number;
    readonly typeAccuracyScore: number;
    readonly suggestionPenalty: number;
  };
  readonly goalDeviation: {
    readonly missingOutcomes: string[];
    readonly unexpectedFields: string[];
    readonly severity: "none" | "low" | "medium" | "high";
  };
  readonly riskFindings: Array<{
    readonly code: string;
    readonly message: string;
    readonly severity: "low" | "medium" | "high";
  }>;
  readonly harnessDecision: {
    readonly action: "accept" | "repair" | "requires_human" | "reject";
    readonly reasonCodes: string[];
  };
}

const DEFAULT_QUALITY_SCORING_CONFIG: QualityScoringConfig = {
  completenessWeight: 0.4,
  typeAccuracyWeight: 0.4,
  suggestionPenalty: 0.1,
};

/**
 * R11-14: Validates input and calculates quality score
 */
function validateWithQualityScoring(
  input: unknown,
  contract: BasicValidationContract,
  scoringConfig: QualityScoringConfig = DEFAULT_QUALITY_SCORING_CONFIG
): QualityEvaluationResult {
  const payload = (input as Record<string, unknown>) ?? {};
  const errors: Array<{ field: string; message: string; severity: "error" | "warning" }> = [];
  const suggestions: string[] = [];

  // Track completeness and accuracy
  let completenessScore = 1.0;
  let typeAccuracyScore = 1.0;
  let missingFieldCount = 0;
  let typeMismatchCount = 0;

  // Check required fields
  for (const field of contract.requiredFields ?? []) {
    if (!(field in payload) || payload[field] == null) {
      errors.push({
        field,
        message: `Missing required field "${field}"`,
        severity: "error",
      });
      suggestions.push(`Provide "${field}" in machine output payload.`);
      missingFieldCount++;
    }
  }

  // Calculate completeness score
  const totalRequiredFields = contract.requiredFields?.length ?? 0;
  if (totalRequiredFields > 0) {
    completenessScore = Math.max(0, 1 - (missingFieldCount / totalRequiredFields));
  }

  // Check field types
  for (const [field, expectedType] of Object.entries(contract.fieldTypes ?? {})) {
    if (!(field in payload)) {
      // Already counted in missing fields
      continue;
    }

    const value = payload[field];
    const actualType = Array.isArray(value) ? "array" : value === null ? "object" : typeof value;
    if (actualType !== expectedType) {
      errors.push({
        field,
        message: `Expected ${expectedType}, received ${actualType}`,
        severity: "error",
      });
      suggestions.push(`Normalize "${field}" to ${expectedType}.`);
      typeMismatchCount++;
    }
  }

  // Calculate type accuracy score
  const totalTypedFields = Object.keys(contract.fieldTypes ?? {}).length;
  if (totalTypedFields > 0) {
    typeAccuracyScore = Math.max(0, 1 - (typeMismatchCount / totalTypedFields));
  }

  const expectedOutcomeFields = contract.expectedOutcomeFields ?? [];
  const missingOutcomes = expectedOutcomeFields.filter((field) => !(field in payload) || payload[field] == null);
  const unexpectedFields = expectedOutcomeFields.length === 0
    ? []
    : Object.keys(payload).filter(
      (field) =>
        !expectedOutcomeFields.includes(field)
        && !(contract.highRiskFields ?? []).includes(field)
        && !(contract.requiredFields ?? []).includes(field)
        && !Object.prototype.hasOwnProperty.call(contract.fieldTypes ?? {}, field),
    );
  const goalDeviationSeverity = missingOutcomes.length >= 2
    ? "high"
    : missingOutcomes.length === 1
      ? "medium"
      : unexpectedFields.length > 0
        ? "low"
        : "none";
  for (const field of missingOutcomes) {
    suggestions.push(`Populate expected outcome field "${field}".`);
  }

  const riskFindings: Array<{
    code: string;
    message: string;
    severity: "low" | "medium" | "high";
  }> = (contract.highRiskFields ?? [])
    .filter((field) => payload[field] != null)
    .map((field) => ({
      code: `risk.high_value_field:${field}`,
      message: `High-risk field "${field}" requires additional review.`,
      severity: "high" as const,
    }));
  if (contract.requiresHumanReviewOnRisk && riskFindings.length === 0 && Object.keys(payload).length > 0) {
    riskFindings.push({
      code: "risk.manual_review_required",
      message: "Contract requires human review for this evaluator result.",
      severity: "medium" as const,
    });
  }

  // Calculate suggestion penalty
  const suggestionPenalty = Math.min(1, suggestions.length * scoringConfig.suggestionPenalty);
  const qualityThreshold = contract.qualityThreshold ?? 0.75;

  // Calculate overall quality score
  const qualityScore = Math.max(
    0,
    Math.min(
      1,
      (completenessScore * scoringConfig.completenessWeight) +
      (typeAccuracyScore * scoringConfig.typeAccuracyWeight) -
      suggestionPenalty
    )
  );

  const reasonCodes = [
    ...(errors.length > 0 ? ["validator.schema_errors"] : []),
    ...(missingOutcomes.length > 0 ? ["validator.goal_deviation"] : []),
    ...(riskFindings.length > 0 ? ["validator.risk_detected"] : []),
    ...(qualityScore < qualityThreshold ? ["validator.quality_below_threshold"] : []),
  ];
  const harnessDecision = riskFindings.some((finding) => finding.severity === "high")
    ? {
        action: "requires_human" as const,
        reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["validator.high_risk_requires_human"],
      }
    : errors.length > 0 && qualityScore < qualityThreshold
      ? {
          action: "reject" as const,
          reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["validator.reject"],
        }
      : errors.length > 0 || missingOutcomes.length > 0
        ? {
            action: "repair" as const,
            reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["validator.repair"],
          }
        : {
            action: "accept" as const,
            reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["validator.accept"],
          };

  return {
    valid: errors.length === 0 && missingOutcomes.length === 0,
    errors,
    suggestions,
    qualityScore: Number(qualityScore.toFixed(2)),
    qualityThreshold,
    scoreBreakdown: {
      completenessScore: Number(completenessScore.toFixed(2)),
      typeAccuracyScore: Number(typeAccuracyScore.toFixed(2)),
      suggestionPenalty: Number(suggestionPenalty.toFixed(2)),
    },
    goalDeviation: {
      missingOutcomes,
      unexpectedFields,
      severity: goalDeviationSeverity,
    },
    riskFindings,
    harnessDecision,
  };
}

function createBasicValidatorPluginInternal(pluginId: string): DomainValidatorPlugin {
  return {
    pluginId,
    domainId: "core",
    spiType: "validator",
    capabilityIds: ["output.validate"],
    async initialize() {
      return undefined;
    },
    async healthCheck() {
      return true;
    },
    async shutdown() {
      return undefined;
    },
    async validate(input) {
      const contract = (input.contract as BasicValidationContract | undefined) ?? {};
      const result = validateWithQualityScoring(input.machineOutput.payload ?? {}, contract);

      return {
        valid: result.valid,
        errors: result.errors,
        suggestions: result.suggestions,
        evaluation: {
          qualityScore: result.qualityScore,
          qualityThreshold: result.qualityThreshold,
          goalDeviation: result.goalDeviation,
          riskFindings: result.riskFindings,
          harnessDecision: result.harnessDecision,
        },
      };
    },
  };
}

export function createBasicValidatorPlugin(): DomainValidatorPlugin {
  return createBasicValidatorPluginInternal("plugin.core.basic-validator");
}

export function createBasicEvaluatorPlugin(): DomainValidatorPlugin {
  return createBasicValidatorPluginInternal("plugin.core.basic-evaluator");
}

/**
 * R11-14: Extended evaluator plugin with quality scoring capability
 */
export function createBasicEvaluatorPluginWithScoring(
  scoringConfig: Partial<QualityScoringConfig> = {}
): DomainValidatorPlugin {
  const config = { ...DEFAULT_QUALITY_SCORING_CONFIG, ...scoringConfig };

  return {
    pluginId: "plugin.core.basic-evaluator-with-scoring",
    domainId: "core",
    spiType: "validator",
    capabilityIds: ["output.validate", "output.quality_score"],
    async initialize() {
      return undefined;
    },
    async healthCheck() {
      return true;
    },
    async shutdown() {
      return undefined;
    },
    async validate(input) {
      const contract = (input.contract as BasicValidationContract | undefined) ?? {};
      const result = validateWithQualityScoring(input.machineOutput.payload ?? {}, contract, config);

      return {
        valid: result.valid,
        errors: result.errors,
        suggestions: result.suggestions,
        evaluation: {
          qualityScore: result.qualityScore,
          qualityThreshold: result.qualityThreshold,
          goalDeviation: result.goalDeviation,
          riskFindings: result.riskFindings,
          harnessDecision: result.harnessDecision,
        },
      };
    },
  };
}
