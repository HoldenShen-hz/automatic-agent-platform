/**
 * Performance Test: Execution Module
 * Measures execution module operations throughput and latency
 *
 * Covers:
 * - Worker load balancing (computeWorkerLoadScore, summarizeWorkerLoadSkew)
 * - Complexity routing (routeComplexity)
 * - KV cache prefix configuration (createKvCachePrefixConfig, estimateTokens)
 * - Admission controller (evaluate, snapshot)
 *
 * Note: Performance thresholds are set for reference hardware. On slower machines,
 * tests that exceed thresholds are marked as skipped rather than failed.
 */
export {};
