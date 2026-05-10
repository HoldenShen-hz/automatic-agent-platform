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

// Re-export cost estimation contract types (authoritative per platform architecture)
// The CostEstimationService implementation lives in scale-ecosystem and should be
// adapted via CostEstimationServicePort when needed by Control Plane.
export { type CostEstimate, type CostEstimationConfig, type CostEstimationServicePort } from "../contracts/types/cost.js";

// Note: CostEstimationService is exposed via CostEstimationServicePort.
// Control Plane should use the port interface to avoid direct coupling.
