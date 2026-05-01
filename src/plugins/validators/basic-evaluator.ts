import type { DomainValidatorPlugin } from "../../domains/registry/plugin-spi.js";

interface BasicValidationContract {
  requiredFields?: string[];
  fieldTypes?: Record<string, "string" | "number" | "boolean" | "array" | "object">;
  /** Target values for deviation detection */
  targetValues?: Record<string, unknown>;
  /** Acceptable deviation threshold (0-1, default 0.1) */
  deviationThreshold?: number;
  /** Risk categories to assess */
  riskCategories?: string[];
}

/**
 * Quality score for machine output evaluation
 */
interface QualityScore {
  overall: number; // 0-1
  completeness: number; // 0-1
  correctness: number; // 0-1
  deviation: number; // 0-1 (0 = on target, 1 = max deviation)
  riskLevel: "low" | "medium" | "high" | "critical";
  riskFactors: string[];
}

/**
 * HarnessDecision output per §13.5
 */
interface HarnessDecision {
  qualityScore: QualityScore;
  deviationAnalysis: Array<{
    field: string;
    expected: unknown;
    actual: unknown;
    deviation: number; // 0-1
    severity: "none" | "warning" | "error";
  }>;
  riskAssessment: Array<{
    category: string;
    level: "low" | "medium" | "high" | "critical";
    evidence: string;
  }>;
  recommendations: string[];
}

/**
 * Normalizes a value to a string for comparison
 */
function normalizeForComparison(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Calculates deviation between actual and target values (0-1)
 */
function calculateDeviation(actual: unknown, target: unknown): number {
  const actualStr = normalizeForComparison(actual);
  const targetStr = normalizeForComparison(target);

  if (actualStr === targetStr) return 0;
  if (targetStr === "") return 0.5; // No target to compare against

  // Levenshtein-like normalized distance for strings
  const maxLen = Math.max(actualStr.length, targetStr.length);
  if (maxLen === 0) return 0;

  let distance = 0;
  const actualLower = actualStr.toLowerCase();
  const targetLower = targetStr.toLowerCase();

  // Simple character-by-character comparison for deviation
  for (let i = 0; i < Math.min(actualStr.length, targetStr.length); i++) {
    if (actualLower[i] !== targetLower[i]) distance++;
  }
  distance += Math.abs(actualStr.length - targetStr.length);

  return Math.min(distance / maxLen, 1);
}

export function createBasicEvaluatorPlugin(): DomainValidatorPlugin {
  const plugin: DomainValidatorPlugin = {
    pluginId: "plugin.core.basic-evaluator",
    domainId: "core",
    spiType: "validator",
    capabilityIds: ["output.validate", "output.evaluate", "output.harness-decision"],
    async initialize() {
      // Plugin lifecycle initialization - validate configuration and allocate resources
      // Per PluginLifecycleHooks, initialize is called once when plugin is loaded
      return undefined;
    },
    async healthCheck() {
      return true;
    },
    async shutdown() {
      return undefined;
    },
    async validate(input): Promise<{
      valid: boolean;
      errors: Array<{ field: string; message: string; severity: "error" | "warning" }>;
      suggestions: string[];
    }> {
      const payload = input.machineOutput.payload ?? {};
      const contract = (input.contract as BasicValidationContract | undefined) ?? {};
      const errors: Array<{ field: string; message: string; severity: "error" | "warning" }> = [];
      const suggestions: string[] = [];

      for (const field of contract.requiredFields ?? []) {
        if (!(field in payload) || payload[field] == null) {
          errors.push({
            field,
            message: `Missing required field "${field}"`,
            severity: "error",
          });
          suggestions.push(`Provide "${field}" in machine output payload.`);
        }
      }

      for (const [field, expectedType] of Object.entries(contract.fieldTypes ?? {})) {
        if (!(field in payload)) {
          if ((contract.requiredFields ?? []).length > 0) {
            errors.push({
              field,
              message: `Expected ${expectedType}, received missing`,
              severity: "error",
            });
            suggestions.push(`Normalize "${field}" to ${expectedType}.`);
          }
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
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        suggestions,
      };
    },
  };

  // Extended evaluation with quality scoring per §13.5
  // These are optional capabilities beyond the base DomainValidatorPlugin interface
  (plugin as DomainValidatorPlugin & {
    evaluate(input: { machineOutput: { payload: Record<string, unknown> }; contract: Record<string, unknown> }): Promise<{ qualityScore: QualityScore; suggestions: string[] }>;
  }).evaluate = async function evaluate(input): Promise<{ qualityScore: QualityScore; suggestions: string[] }> {
    const payload = input.machineOutput.payload ?? {};
    const contract = (input.contract as BasicValidationContract | undefined) ?? {};
    const targetValues = contract.targetValues ?? {};
    const threshold = contract.deviationThreshold ?? 0.1;

    const deviationAnalysis: Array<{
      field: string;
      expected: unknown;
      actual: unknown;
      deviation: number;
      severity: "none" | "warning" | "error";
    }> = [];

    const riskFactors: string[] = [];
    let totalDeviation = 0;
    let deviationCount = 0;

    // Calculate deviation for target values
    for (const [field, target] of Object.entries(targetValues)) {
      const actual = payload[field];
      const deviation = calculateDeviation(actual, target);
      totalDeviation += deviation;

      let severity: "none" | "warning" | "error" = "none";
      if (deviation > threshold) {
        severity = deviation > threshold * 2 ? "error" : "warning";
        riskFactors.push(`${field} exceeds deviation threshold (${(deviation * 100).toFixed(1)}%)`);
      }

      deviationAnalysis.push({
        field,
        expected: target,
        actual: actual ?? null,
        deviation,
        severity,
      });
      deviationCount++;
    }

    // Calculate completeness score
    const requiredFields = contract.requiredFields ?? [];
    const presentRequiredFields = requiredFields.filter(
      (f) => f in payload && payload[f] != null,
    );
    const completeness = requiredFields.length > 0
      ? presentRequiredFields.length / requiredFields.length
      : 1;

    // Calculate correctness score (inverse of error rate)
    const typeErrors = Object.entries(contract.fieldTypes ?? {}).filter(([field, expectedType]) => {
      const value = payload[field];
      if (value == null) return false;
      const actualType = Array.isArray(value) ? "array" : typeof value;
      return actualType !== expectedType;
    }).length;

    const totalFields = Object.keys(contract.fieldTypes ?? {}).length +
      requiredFields.filter((f) => !(f in payload)).length;
    const correctness = totalFields > 0 ? 1 - (typeErrors / totalFields) : 1;

    // Calculate overall deviation
    const deviation = deviationCount > 0 ? totalDeviation / deviationCount : 0;

    // Calculate overall quality score
    const overall = (completeness + correctness + (1 - deviation)) / 3;

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical" = "low";
    if (overall < 0.5 || deviation > threshold * 3) {
      riskLevel = "critical";
    } else if (overall < 0.7 || deviation > threshold * 2) {
      riskLevel = "high";
    } else if (overall < 0.85 || deviation > threshold) {
      riskLevel = "medium";
    }

    const qualityScore: QualityScore = {
      overall: Math.round(overall * 100) / 100,
      completeness: Math.round(completeness * 100) / 100,
      correctness: Math.round(correctness * 100) / 100,
      deviation: Math.round(deviation * 100) / 100,
      riskLevel,
      riskFactors,
    };

    const suggestions: string[] = [];

    // Generate suggestions based on quality score
    if (completeness < 1) {
      const missingFields = requiredFields.filter(
        (f) => !(f in payload) || payload[f] == null,
      );
      for (const field of missingFields) {
        suggestions.push(`Complete missing field "${field}" to improve completeness.`);
      }
    }

    if (deviation > threshold) {
      suggestions.push(`Consider adjusting output to closer match target values.`);
    }

    if (correctness < 1) {
      suggestions.push(`Fix type mismatches in output fields.`);
    }

    return { qualityScore, suggestions };
  };

  // Produce HarnessDecision per §13.5
  (plugin as DomainValidatorPlugin & {
    produceHarnessDecision(input: { machineOutput: { payload: Record<string, unknown> }; contract: Record<string, unknown> }): Promise<HarnessDecision>;
  }).produceHarnessDecision = async function produceHarnessDecision(input): Promise<HarnessDecision> {
    const payload = input.machineOutput.payload ?? {};
    const contract = (input.contract as BasicValidationContract | undefined) ?? {};
    const targetValues = contract.targetValues ?? {};
    const threshold = contract.deviationThreshold ?? 0.1;

    // Run evaluation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evaluateFn = (plugin as any).evaluate;
    const { qualityScore, suggestions } = await evaluateFn(input);

    // Build deviation analysis
    const deviationAnalysis: HarnessDecision["deviationAnalysis"] = [];
    for (const [field, target] of Object.entries(targetValues)) {
      const actual = payload[field];
      const deviation = calculateDeviation(actual, target);

      let severity: "none" | "warning" | "error" = "none";
      if (deviation > threshold) {
        severity = deviation > threshold * 2 ? "error" : "warning";
      }

      deviationAnalysis.push({
        field,
        expected: target,
        actual: actual ?? null,
        deviation,
        severity,
      });
    }

    // Build risk assessment
    const riskAssessment: HarnessDecision["riskAssessment"] = [];

    // Data quality risk
    if (qualityScore.completeness < 0.8) {
      riskAssessment.push({
        category: "data_quality",
        level: qualityScore.completeness < 0.5 ? "high" : "medium",
        evidence: `Completeness score is ${(qualityScore.completeness * 100).toFixed(1)}%`,
      });
    }

    // Deviation risk
    if (qualityScore.deviation > threshold) {
      riskAssessment.push({
        category: "target_deviation",
        level: qualityScore.deviation > threshold * 3 ? "high"
          : qualityScore.deviation > threshold * 2 ? "medium" : "low",
        evidence: `Deviation from target is ${(qualityScore.deviation * 100).toFixed(1)}%`,
      });
    }

    // Safety risk (if output has potential safety implications)
    const hasSafetyFields = ["safety", "kill", "abort", "emergency"].some(
      (f) => f in payload,
    );
    if (hasSafetyFields && qualityScore.correctness < 0.9) {
      riskAssessment.push({
        category: "safety",
        level: qualityScore.correctness < 0.7 ? "critical" : "high",
        evidence: `Safety-relevant fields have type errors or missing values`,
      });
    }

    // Performance risk
    const hasPerformanceFields = ["latency", "duration", "timeout", "memory", "cpu"].some(
      (f) => f in payload,
    );
    if (hasPerformanceFields && qualityScore.deviation > threshold) {
      riskAssessment.push({
        category: "performance",
        level: qualityScore.deviation > threshold * 2 ? "medium" : "low",
        evidence: `Performance-related fields deviate from target`,
      });
    }

    // Add recommendations
    const recommendations: string[] = [...suggestions];

    if (riskAssessment.some((r) => r.level === "critical" || r.level === "high")) {
      recommendations.push("Review output before use - high risk issues detected.");
    }

    if (qualityScore.overall >= 0.9 && deviationAnalysis.every((d) => d.severity === "none")) {
      recommendations.push("Output meets quality standards.");
    }

    return {
      qualityScore,
      deviationAnalysis,
      riskAssessment,
      recommendations,
    };
  };

  return plugin;
}
