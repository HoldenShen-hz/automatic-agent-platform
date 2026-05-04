import type {
  RiskConfig,
  RiskEvaluationRequest,
  RiskFactors,
} from "../../src/platform/control-plane/risk-control/types.js";

export function createCanonicalRiskConfig(): RiskConfig {
  return {
    factorWeights: {
      operationRisk: 3,
      targetResourceCriticality: 3,
      dataSensitivity: 3,
      autonomyModeRisk: 2,
      tenantImpact: 2,
      blastRadius: 2,
      historicalFailureRate: 2,
      evidenceConfidence: 1,
    },
    operationRiskValues: {
      read: 0.2,
      write: 0.6,
      delete: 1.0,
      external_call: 0.8,
    },
    targetResourceCriticalityValues: {
      internal: 0.2,
      staging: 0.4,
      production: 1.0,
    },
    dataSensitivityValues: {
      public: 0.2,
      internal: 0.4,
      confidential: 0.8,
      restricted: 1.0,
    },
    autonomyModeRiskValues: {
      full_auto: 0.2,
      semi_auto: 0.4,
      supervised: 0.6,
      manual: 1.0,
    },
    tenantImpactValues: {
      single_task: 0.2,
      workflow: 0.4,
      tenant: 0.6,
      platform: 1.0,
    },
    blastRadiusValues: {
      single_task: 0.2,
      workflow: 0.4,
      tenant: 0.6,
      platform: 1.0,
    },
    historicalFailureRateThresholds: {
      low: { maxPercent: 10, value: 0.2 },
      medium: { maxPercent: 30, value: 0.4 },
      high: { maxPercent: 50, value: 0.6 },
      critical: { maxPercent: 100, value: 1.0 },
    },
    evidenceConfidenceValues: {
      high: 0.2,
      medium: 0.6,
      low: 1.0,
    },
    riskLevelThresholds: {
      low: 0.25,
      medium: 0.5,
      high: 0.75,
      critical: 1.0,
    },
    riskLevelActions: {
      low: {
        autoExecute: true,
        logLevel: "info",
        requiresApproval: false,
        sideEffect: "normal",
        evidenceLevel: "basic",
      },
      medium: {
        autoExecute: false,
        logLevel: "warn",
        requiresApproval: true,
        approvalType: "standard",
        sideEffect: "normal_with_validation",
        evidenceLevel: "enhanced",
      },
      high: {
        autoExecute: false,
        logLevel: "error",
        requiresApproval: true,
        approvalType: "standard",
        sideEffect: "restricted",
        evidenceLevel: "full",
      },
      critical: {
        autoExecute: false,
        logLevel: "critical",
        requiresApproval: true,
        approvalType: "break_glass",
        sideEffect: "prohibited",
        evidenceLevel: "legal",
      },
    },
  };
}

export function createRiskFactors(overrides: Partial<RiskFactors> = {}): RiskFactors {
  return {
    operationRisk: "write",
    targetResourceCriticality: "staging",
    dataSensitivity: "internal",
    autonomyModeRisk: "supervised",
    tenantImpact: "workflow",
    blastRadius: "workflow",
    historicalFailureRate: "medium",
    evidenceConfidence: "medium",
    ...overrides,
  };
}

export function createLowRiskFactors(overrides: Partial<RiskFactors> = {}): RiskFactors {
  return createRiskFactors({
    operationRisk: "read",
    targetResourceCriticality: "internal",
    dataSensitivity: "public",
    autonomyModeRisk: "full_auto",
    tenantImpact: "single_task",
    blastRadius: "single_task",
    historicalFailureRate: "low",
    evidenceConfidence: "high",
    ...overrides,
  });
}

export function createMediumRiskFactors(overrides: Partial<RiskFactors> = {}): RiskFactors {
  return createRiskFactors({
    operationRisk: "write",
    targetResourceCriticality: "production",
    dataSensitivity: "internal",
    autonomyModeRisk: "supervised",
    tenantImpact: "workflow",
    blastRadius: "workflow",
    historicalFailureRate: "medium",
    evidenceConfidence: "medium",
    ...overrides,
  });
}

export function createHighRiskFactors(overrides: Partial<RiskFactors> = {}): RiskFactors {
  return createRiskFactors({
    operationRisk: "delete",
    targetResourceCriticality: "production",
    dataSensitivity: "confidential",
    autonomyModeRisk: "supervised",
    tenantImpact: "tenant",
    blastRadius: "tenant",
    historicalFailureRate: "high",
    evidenceConfidence: "low",
    ...overrides,
  });
}

export function createCriticalRiskFactors(overrides: Partial<RiskFactors> = {}): RiskFactors {
  return createRiskFactors({
    operationRisk: "delete",
    targetResourceCriticality: "production",
    dataSensitivity: "restricted",
    autonomyModeRisk: "manual",
    tenantImpact: "platform",
    blastRadius: "platform",
    historicalFailureRate: "critical",
    evidenceConfidence: "low",
    ...overrides,
  });
}

export function createRiskRequest(
  factors: RiskFactors,
  overrides: Partial<RiskEvaluationRequest> = {},
): RiskEvaluationRequest {
  return {
    taskId: "task-risk-test",
    factors,
    ...overrides,
  };
}
