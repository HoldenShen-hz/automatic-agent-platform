import type { DomainValidatorPlugin } from "../../domains/registry/plugin-spi.js";

interface BasicValidationContract {
  requiredFields?: string[];
  fieldTypes?: Record<string, "string" | "number" | "boolean" | "array" | "object">;
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
  /** R11-14: Quality score from 0-1 */
  readonly qualityScore: number;
  /** R11-14: Breakdown of score factors */
  readonly scoreBreakdown: {
    readonly completenessScore: number;
    readonly typeAccuracyScore: number;
    readonly suggestionPenalty: number;
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

  // Calculate suggestion penalty
  const suggestionPenalty = Math.min(1, suggestions.length * scoringConfig.suggestionPenalty);

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

  return {
    valid: errors.length === 0,
    errors,
    suggestions,
    qualityScore: Number(qualityScore.toFixed(2)),
    scoreBreakdown: {
      completenessScore: Number(completenessScore.toFixed(2)),
      typeAccuracyScore: Number(typeAccuracyScore.toFixed(2)),
      suggestionPenalty: Number(suggestionPenalty.toFixed(2)),
    },
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
        // R11-14: Include quality score in result
        qualityScore: result.qualityScore,
        scoreBreakdown: result.scoreBreakdown,
      };
    },
  };
}
