/**
 * Risk Control Module
 *
 * Implements §10 Risk Control Architecture:
 * - RiskEvaluationEngine: Weighted scoring algorithm with 6 factors
 * - 4 risk levels: LOW, MEDIUM, HIGH, CRITICAL
 * - Config-driven risk matrix from config/risk/default.json
 * - Domain-level risk profile overrides
 *
 * @see docs_zh/architecture/00-platform-architecture.md §10
 */

export {
  RiskEvaluationEngine,
  RiskEvaluationError,
} from "./risk-evaluation-engine.js";

export { loadRiskConfig } from "./risk-config-loader.js";

export type {
  RiskLevel,
  StepTypeRisk,
  TargetSystemRisk,
  DataClassRisk,
  BlastRadius,
  ConfidenceLevel,
  RiskFactors,
  RiskEvaluationRequest,
  RiskEvaluationResult,
  RiskEvaluationEngineOptions,
  RiskConfig,
  RiskLevelActionConfig,
} from "./types.js";
