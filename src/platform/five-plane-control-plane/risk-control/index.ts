/**
 * Risk Control Module
 *
 * Implements ADR-026 Risk Control Architecture:
 * - RiskEvaluationEngine: 8-factor weighted scoring algorithm
 * - 4 risk levels: LOW, MEDIUM, HIGH, CRITICAL
 * - Config-driven risk matrix from config/risk/default.json
 * - Domain-level risk profile overrides
 *
 * @see docs_en/adr/026-risk-control-architecture.md
 */

export {
  RiskEvaluationEngine,
  RiskEvaluationError,
} from "./risk-evaluation-engine.js";

export { loadRiskConfig } from "./risk-config-loader.js";

export type {
  RiskLevel,
  OperationRisk,
  TargetResourceCriticality,
  DataSensitivity,
  AutonomyModeRisk,
  TenantImpact,
  BlastRadius,
  HistoricalFailureRate,
  EvidenceConfidence,
  RiskFactors,
  RiskEvaluationRequest,
  RiskEvaluationResult,
  RiskEvaluationEngineOptions,
  RiskConfig,
  RiskLevelActionConfig,
} from "./types.js";
