export * from "./cross-region-routing-service.js";
export * from "./data-replicator/index.js";
export * from "./failover-controller/index.js";
export * from "./failover-reconciliation-job.js";
export * from "./remote-session-state.js";
export * from "./region-router/index.js";
export * from "./cdc-replication-service.js";

// Explicitly export RegionHealthCheck types for better TypeScript support
export {
  RegionHealthCheckService,
  RegionFailoverOrchestrator,
  HEALTH_CHECK_EVENTS,
} from "./region-health-check-service.js";
export type {
  RegionHealthStatus,
  HealthCheckMetric,
  RegionHealthCheckResult,
  RegionHealthCheckConfig,
  RegionHealthSummary,
} from "./region-health-check-service.js";
