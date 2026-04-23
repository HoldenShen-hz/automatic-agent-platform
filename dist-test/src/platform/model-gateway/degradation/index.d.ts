/**
 * Degradation Module
 *
 * D0-D4 five-level degradation strategy for LLM service resilience.
 */
export { DegradationLevel, DEFAULT_DEGRADATION_CONFIG, DEFAULT_TEMPLATE_RESPONSES, type ProviderMetrics, type DegradationConfig, type LLMDegradationRequest, type LLMDegradationResponse, } from "./degradation-controller.js";
export { DegradationController } from "./degradation-controller.js";
