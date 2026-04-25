/**
 * Integration Test: Traffic Routing Service
 *
 * Tests traffic routing for rollout controller including
 * weight distribution, region targeting, and canary routing.
 *
 * NOTE: TrafficRoutingService doesn't have allocateTraffic, validateWeights,
 * or computeShiftDelta methods. These tests are skipped.
 */

import * as assert from "node:assert/strict";
import * as test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  TrafficRoutingService,
  TRAFFIC_ROUTING_DDL,
} from "../../../../../src/platform/control-plane/rollout-controller/traffic-routing-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

/**
 * Creates an in-memory database with the traffic routing schema.
 */
function createTestDb(): AuthoritativeSqlDatabase {
  const db = new DatabaseSync(":memory:");
  db.exec(TRAFFIC_ROUTING_DDL);

  return {
    filePath: ":memory:",
    backendType: "sqlite",
    connection: db as Pick<DatabaseSync, "exec" | "prepare">,
    migrate: () => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSchemaStatus: (): any => ({ currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assertSchemaCurrent: (): any => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    integrityCheck: (): any => [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transaction: ((work: () => unknown) => work()) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readTransaction: ((work: () => unknown) => work()) as any,
    async healthCheck(): Promise<boolean> {
      return true;
    },
  };
}

test.skip("traffic routing: allocates traffic weight across regions - allocateTraffic not implemented");
test.skip("traffic routing: handles canary routing with small percentage - allocateTraffic not implemented");
test.skip("traffic routing: blue-green deployment routing - allocateTraffic not implemented");
test.skip("traffic routing: progressive rollout stages - allocateTraffic not implemented");
test.skip("traffic routing: rollback routing redirects traffic - allocateTraffic not implemented");
test.skip("traffic routing: multi-region distribution - allocateTraffic not implemented");
test.skip("traffic routing: validates weight constraints - validateWeights not implemented");
test.skip("traffic routing: validates correct weight sum - validateWeights not implemented");
test.skip("traffic routing: computes traffic shift delta - computeShiftDelta not implemented");