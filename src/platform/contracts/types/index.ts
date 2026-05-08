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

// Re-export control-directive legacy factory for backward compatibility
export { createControlDirective } from "../control-directive/index.js";

// Re-export execution-plan legacy factory for backward compatibility
// NOTE: createExecutionPlan is forbidden and throws; retained for import compatibility
export { createExecutionPlan } from "../execution-plan/index.js";

// Re-export execution-receipt legacy factory for backward compatibility
export { createExecutionReceipt } from "../execution-receipt/index.js";

// Re-export state-command factory (was removed in R16-79, restored for backward compat)
export { createStateCommand } from "../state-command/index.js";
