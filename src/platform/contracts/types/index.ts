/**
 * Types Module Barrel
 *
 * Re-exports type utilities and constants:
 * - ID generation utilities
 * - Status constants
 * - Cross-layer contract types
 */

export * from "./ids.js";
export * from "./anomaly-event-classification.js";
export * from "./data-classification.js";
export * from "./platform-contracts.js";
export * from "./recovery-cadence.js";
export * from "./status.js";
export * from "./unified-runtime-mode.js";
export * from "./unified-severity.js";

// Re-export legacy factory functions for backward compatibility
// These factories throw ValidationError when called (deprecated per §4.3)
// NOTE: createExecutionPlan removed per ADR-109 (R16-77)
export * from "./feedback.js";
export * from "./governance.js";
export * from "./health.js";
export * from "./cost.js";
export * from "./domain/index.js";
