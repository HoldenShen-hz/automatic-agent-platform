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

interface BasicEvaluationContract extends BasicValidationContract {
  targetValues?: Record<string, unknown>;
  deviationThreshold?: number;
}

interface EvaluatorQualityScore {
  overall: number;
  completeness: number;
  correctness: number;
  deviation: number;
  threshold: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskFactors: string[];
}

interface EvaluatorAssessment {
  valid: boolean;
  errors: Array<{ field: string; message: string; severity: "error" | "warning" }>;
  suggestions: string[];
  qualityScore: EvaluatorQualityScore;
  deviationAnalysis: Array<{ field: string; expected: unknown; actual: unknown; severity: "low" | "medium" | "high" }>;
  riskAssessment: Array<{ category: string; level: "low" | "medium" | "high" | "critical"; message: string }>;
  recommendations: string[];
  harnessDecision: {
    action: "accept" | "repair" | "requires_human" | "reject";
    reasonCodes: string[];
  };
}

type ValidatorInput = {
  machineOutput: { payload?: Record<string, unknown> };
  contract?: BasicEvaluationContract;
};

const DEFAULT_QUALITY_SCORING_CONFIG: QualityScoringConfig = {
  completenessWeight: 0.4,
  typeAccuracyWeight: 0.4,
  suggestionPenalty: 0.1,
};

function describeValueType(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function highestRiskLevel(levels: Array<"low" | "medium" | "high" | "critical">): "low" | "medium" | "high" | "critical" {
  if (levels.includes("critical")) {
    return "critical";
  }
  if (levels.includes("high")) {
    return "high";
  }
  if (levels.includes("medium")) {
    return "medium";
  }
  return "low";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

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
      if ((contract.requiredFields ?? []).length === 0) {
        continue;
      }
      errors.push({
        field,
        message: `Expected ${expectedType}, received missing`,
        severity: "error",
      });
      suggestions.push(`Provide "${field}" as ${expectedType}.`);
      typeMismatchCount++;
      continue;
    }

    const value = payload[field];
    const actualType = describeValueType(value);
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

function evaluateWithLegacyScoring(
  input: unknown,
  contract: BasicEvaluationContract,
  scoringConfig: QualityScoringConfig = DEFAULT_QUALITY_SCORING_CONFIG,
): EvaluatorAssessment {
  const payload = (input as Record<string, unknown>) ?? {};
  const validation = validateWithQualityScoring(payload, contract, scoringConfig);
  const targetValues = contract.targetValues ?? {};
  const deviationEntries = Object.entries(targetValues);
  const deviationAnalysis = deviationEntries.map(([field, expected]) => ({
      field,
      expected,
      actual: payload[field],
      severity:
        payload[field] === expected
          ? "low" as const
          : payload[field] == null
            ? "high" as const
            : "medium" as const,
    }));
  const deviation = deviationEntries.length === 0
    ? 0
    : Number((deviationAnalysis.filter((entry) => entry.actual !== entry.expected).length / deviationEntries.length).toFixed(2));

  const riskAssessment: Array<{ category: string; level: "low" | "medium" | "high" | "critical"; message: string }> = [];
  if (validation.errors.length > 0) {
    riskAssessment.push({
      category: "schema",
      level: validation.errors.length >= 3 ? "high" : "medium",
      message: `${validation.errors.length} validation issue(s) detected.`,
    });
  }
  if (deviation > (contract.deviationThreshold ?? 0.1)) {
    riskAssessment.push({
      category: "quality",
      level: deviation >= 0.5 ? "high" : "medium",
      message: `Observed deviation ${deviation} exceeds threshold ${(contract.deviationThreshold ?? 0.1).toFixed(2)}.`,
    });
  }
  const safetyFields = uniqueStrings([
    ...(contract.highRiskFields ?? []),
    ...Object.keys(payload).filter((field) => /safety|kill|security|danger|secret/i.test(field)),
  ]);
  for (const field of safetyFields) {
    riskAssessment.push({
      category: "safety",
      level: "high",
      message: `Field "${field}" is safety-sensitive and requires review.`,
    });
  }
  if ((contract.requiredFields?.length ?? 0) >= 4 && validation.errors.length > 0) {
    riskAssessment.push({
      category: "completeness",
      level: validation.errors.length >= 4 ? "critical" : "high",
      message: "A large portion of required fields is missing or invalid.",
    });
  }
  const riskLevel = highestRiskLevel(riskAssessment.map((risk) => risk.level));
  const correctness = validation.scoreBreakdown.typeAccuracyScore;
  const completeness = validation.scoreBreakdown.completenessScore;
  const overall = Number(Math.max(
    0,
    Math.min(
      1,
      (completeness * 0.4) +
      (correctness * 0.35) +
      ((1 - deviation) * 0.25),
    ),
  ).toFixed(2));
  const recommendations = uniqueStrings([
    ...validation.suggestions,
    ...riskAssessment.map((risk) => `Review ${risk.category} risk: ${risk.message}`),
  ]);
  const harnessDecision = riskLevel === "critical" || riskLevel === "high"
    ? {
        action: "requires_human" as const,
        reasonCodes: uniqueStrings([...validation.harnessDecision.reasonCodes, "validator.high_risk_requires_human"]),
      }
    : validation.harnessDecision;

  return {
    valid: validation.valid,
    errors: validation.errors,
    suggestions: validation.suggestions,
    qualityScore: {
      overall,
      completeness,
      correctness,
      deviation,
      threshold: contract.deviationThreshold ?? validation.qualityThreshold,
      riskLevel,
      riskFactors: uniqueStrings(riskAssessment.map((risk) => risk.category)),
    },
    deviationAnalysis,
    riskAssessment,
    recommendations,
    harnessDecision,
  };
}

function createBasicValidatorPluginInternal(pluginId: string): DomainValidatorPlugin {
  let initialized = false;
  const plugin = {
    pluginId,
    domainId: "core",
    spiType: "validator",
    capabilityIds: ["output.validate"],
    async initialize() {
      initialized = true;
      return undefined;
    },
    async healthCheck() {
      return true;
    },
    async shutdown() {
      initialized = false;
      return undefined;
    },
    async validate(input: ValidatorInput) {
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
    async evaluate(input: ValidatorInput) {
      return evaluateWithLegacyScoring(input.machineOutput.payload ?? {}, input.contract ?? {});
    },
    async produceHarnessDecision(input: ValidatorInput) {
      return evaluateWithLegacyScoring(input.machineOutput.payload ?? {}, input.contract ?? {});
    },
  };

  return plugin as DomainValidatorPlugin;
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
