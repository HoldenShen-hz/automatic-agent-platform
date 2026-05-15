/**
 * Control Plane Balancer CLI
 *
 * This module provides a command-line interface for managing coordinator load balancing
 * via heartbeat registration and coordinator selection. It enables health monitoring
 * and routing decisions for the control plane in HA setups.
 *
 * Environment Variables (via loadControlPlaneBalancerCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_CONTROL_PLANE_BALANCER_ACTION: Action to perform - heartbeat, select, or summary (default)
 *   - AA_COORDINATOR_ID: Coordinator identifier for heartbeat/select operations
 *   - AA_COORDINATOR_REGION: Geographic region for the coordinator
 *
 * Actions:
 *   - heartbeat: Register coordinator health status and load metrics
 *   - select: Choose the best coordinator based on load and affinity
 *   - summary: List all coordinators with their status (default)
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for HA coordinator architecture
 * @see {@link docs_zh/contracts/ha_coordinator_and_leader_election_contract.md} for coordinator contracts
 */

import { withCliStorage } from "./authoritative-storage.js";
import { loadControlPlaneBalancerCliEnv } from "../../platform/five-plane-control-plane/config-center/remaining-cli-env.js";
import { CoordinatorLoadBalancingService } from "../../platform/five-plane-execution/ha/coordinator-load-balancing-service.js";

const envConfig = loadControlPlaneBalancerCliEnv();
const result = withCliStorage((storage) => {
  const service = new CoordinatorLoadBalancingService(storage.sql, storage.store);

  if (envConfig.action === "heartbeat") {
    return service.registerHeartbeat({
      coordinatorId: envConfig.coordinatorId ?? "",
      region: envConfig.coordinatorRegion ?? "",
      ...(envConfig.role ? { role: envConfig.role } : {}),
      ...(envConfig.queueAffinity ? { queueAffinity: envConfig.queueAffinity } : {}),
      ...(envConfig.status ? { status: envConfig.status } : {}),
      ...(envConfig.maxConcurrentDispatches != null ? { maxConcurrentDispatches: envConfig.maxConcurrentDispatches } : {}),
      ...(envConfig.activeDispatchCount != null ? { activeDispatchCount: envConfig.activeDispatchCount } : {}),
      ...(envConfig.backlogCount != null ? { backlogCount: envConfig.backlogCount } : {}),
      ...(envConfig.cpuPct != null ? { cpuPct: envConfig.cpuPct } : {}),
      ...(envConfig.shards != null ? { shards: envConfig.shards } : {}),
    });
  }

  if (envConfig.action === "select") {
    return service.selectCoordinator({
      ...(envConfig.queueName ? { queueName: envConfig.queueName } : {}),
      ...(envConfig.preferredRegion ? { preferredRegion: envConfig.preferredRegion } : {}),
      ...(envConfig.tenantId ? { tenantId: envConfig.tenantId } : {}),
      ...(envConfig.requestKey ? { requestKey: envConfig.requestKey } : {}),
    });
  }

  return {
    summary: service.buildSummary(),
    coordinators: service.listSnapshots(50),
  };
}, { dbPath: envConfig.dbPath });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
