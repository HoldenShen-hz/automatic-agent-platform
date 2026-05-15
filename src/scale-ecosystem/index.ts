export * as architectureRemediation from "./architecture-remediation.js";
export * from "./billing/index.js";
export * from "./capacity-planning/index.js";
export * from "./cost-attribution/index.js";
export * from "./enterprise/index.js";
export * from "./federation/index.js"; // R13-21: Federation module exports
export * from "./feedback-loop/index.js";
export * from "./intelligence/index.js";
export * from "./runtime-governance-service.js";
export * from "./integration/index.js";
export * from "./marketplace/index.js";
export * as multiRegion from "./multi-region/index.js";
export { CDCReplicationService as CdcReplicationService } from "./multi-region/cdc-replication-service.js";
export { RegionFailoverController as FailoverController } from "./multi-region/failover-controller/index.js";
export { selectPreferredRegion as selectPreferredRegionRouterRegion } from "./multi-region/region-router/index.js";
export * from "./operations/index.js";
export * from "./resource-manager/index.js";
export * from "./runtime-services/index.js";
export * from "./scale-baseline-catalog.js";
export * from "./scale-bootstrap.js";
export * from "./sla-engine/index.js";
export * from "./tenant-platform/index.js";
export {
  CrossRegionRoutingService,
  DataReplicatorService,
  RegionHealthCheckService,
} from "./multi-region/index.js";
