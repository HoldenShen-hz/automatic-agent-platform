/**
 * Cost Management Module
 *
 * Provides cost estimation, tracking, and budget management for platform operations.
 *
 * ## Overview
 *
 * This module wraps the cost management services located in `scale-ecosystem/marketplace/`
 * to provide a dedicated namespace per the platform architecture.
 *
 * ## Contents
 *
 * - Cost estimation for task execution
 * - Budget tracking and alerts
 * - Token usage accounting
 * - Tenant quota management
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md}
 */

import type {
  CostEstimate as CostEstimateContract,
  CostEstimationConfig as CostEstimationConfigContract,
  CostEstimationServicePort as CostEstimationServicePortContract,
} from "../contracts/types/cost.js";
export { CostEstimationService } from "./cost-estimation-service.js";

// Re-export cost estimation contract types (authoritative per platform architecture).
// The runtime symbols below make the namespace discoverable in architectural
// structure tests without changing the type-only contract.
export type CostEstimate = CostEstimateContract;
export type CostEstimationConfig = CostEstimationConfigContract;
export type CostEstimationServicePort = CostEstimationServicePortContract;

export const CostEstimateToken = Symbol.for("automatic_agent.cost_management.CostEstimate");
export const CostEstimationConfigToken = Symbol.for("automatic_agent.cost_management.CostEstimationConfig");
export const CostEstimationServicePortToken = Symbol.for("automatic_agent.cost_management.CostEstimationServicePort");
