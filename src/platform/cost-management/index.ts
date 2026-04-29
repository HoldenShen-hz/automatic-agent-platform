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
 * @see {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/architecture/00-platform-architecture.md}
 */

// Re-export cost estimation types from contracts
export type { CostEstimate, CostEstimationConfig } from "../contracts/types/cost.js";

// Re-export cost estimation service from scale-ecosystem
export { CostEstimationService } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
