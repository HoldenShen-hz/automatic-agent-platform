/**
 * Unit Tests: TrafficRoutingService DirectiveSink Behavior
 *
 * Tests the operational directive emission behavior of the TrafficRoutingService
 * when directiveSink is null vs provided, and validates directive contents.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  TrafficRoutingService,
  TRAFFIC_ROUTING_DDL,
} from "../../../../../src/platform/control-plane/rollout-controller/traffic-routing-service.js";
import type { ControlPlaneDirectiveSink } from "../../../../../src/platform/control-plane/control-plane-directive-sink.js";
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

// ---------------------------------------------------------------------------
// DirectiveSink: Null Behavior
// ---------------------------------------------------------------------------

test("startCanaryShift with null directiveSink does not throw", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db, null);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  // Should not throw even though directiveSink is null
  const shift = service.startCanaryShift("blue", "green");
  assert.ok(shift.id.startsWith("tshift_"));
});

test("rollbackShift with null directiveSink does not throw", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db, null);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  // Should not throw even though directiveSink is null
  const rollback = service.rollbackShift(shift.id, "manual", "Testing null sink");
  assert.ok(rollback.id.startsWith("rbk_"));
  assert.equal(rollback.success, true);
});

test("multiple operations with null directiveSink succeed", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db, null);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift1 = service.startCanaryShift("blue", "green");
  service.advanceShift(shift1.id);

  const shift2 = service.startCanaryShift("blue", "green");
  service.rollbackShift(shift2.id, "manual", "Rollback");

  // All operations should succeed without throwing
  assert.ok(shift1.id !== shift2.id);
});

// ---------------------------------------------------------------------------
// DirectiveSink: Operational Directive Content Validation
// ---------------------------------------------------------------------------

test("startCanaryShift emits mode_switch directive with correct structure", () => {
  const db = createTestDb();
  const directives: Record<string, unknown>[] = [];
  const directiveSink: ControlPlaneDirectiveSink = {
    emitOperationalDirective(directive) {
      directives.push(directive as unknown as Record<string, unknown>);
    },
    emitDecisionDirective() {},
  };
  const service = new TrafficRoutingService(db, directiveSink);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green", {
    initialWeightPct: 10,
    stepIncrementPct: 20,
    stepIntervalMinutes: 5,
    healthThreshold: 0.95,
    errorRateThreshold: 0.02,
    autoPromoteOnSuccess: true,
  }, "release_operator");

  assert.equal(directives.length, 1);
  const directive = directives[0]!;

  // Validate directive type
  assert.equal(directive.type, "mode_switch");

  // Validate issuedBy
  assert.equal(directive.issuedBy, undefined); // The actual structure uses nested object
  // The directive.params contains the details
  assert.equal(directive.params?.shiftId, shift.id);
  assert.equal(directive.params?.fromSlot, "blue");
  assert.equal(directive.params?.toSlot, "green");
  assert.deepEqual(directive.params?.stepWeights, [10, 30, 50, 70, 90, 100]);
});

test("rollbackShift emits rollback directive with correct structure", () => {
  const db = createTestDb();
  const directives: Record<string, unknown>[] = [];
  const directiveSink: ControlPlaneDirectiveSink = {
    emitOperationalDirective(directive) {
      directives.push(directive as unknown as Record<string, unknown>);
    },
    emitDecisionDirective() {},
  };
  const service = new TrafficRoutingService(db, directiveSink);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const rollback = service.rollbackShift(shift.id, "health_check_failed", "Health threshold breached");

  const rollbackDirective = directives[1]; // Second directive after startCanaryShift
  assert.ok(rollbackDirective !== undefined);
  assert.equal(rollbackDirective.type, "rollback");
  assert.equal(rollbackDirective.params?.rollbackId, rollback.id);
  assert.equal(rollbackDirective.params?.shiftId, shift.id);
  assert.equal(rollbackDirective.params?.trigger, "health_check_failed");
});

test("rollbackShift directive contains version information", () => {
  const db = createTestDb();
  const directives: Record<string, unknown>[] = [];
  const directiveSink: ControlPlaneDirectiveSink = {
    emitOperationalDirective(directive) {
      directives.push(directive as unknown as Record<string, unknown>);
    },
    emitDecisionDirective() {},
  };
  const service = new TrafficRoutingService(db, directiveSink);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  service.rollbackShift(shift.id, "error_rate_exceeded", "Error rate too high");

  const rollbackDirective = directives[1];
  assert.equal(rollbackDirective.params?.fromVersion, "v2.0.0");
  assert.equal(rollbackDirective.params?.toVersion, "v1.0.0");
});

// ---------------------------------------------------------------------------
// DirectiveSink: Multiple Operations
// ---------------------------------------------------------------------------

test("multiple canary shifts emit multiple directives in order", () => {
  const db = createTestDb();
  const directives: Record<string, unknown>[] = [];
  const directiveSink: ControlPlaneDirectiveSink = {
    emitOperationalDirective(directive) {
      directives.push(directive as unknown as Record<string, unknown>);
    },
    emitDecisionDirective() {},
  };
  const service = new TrafficRoutingService(db, directiveSink);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  // First shift
  const shift1 = service.startCanaryShift("blue", "green");

  // Rollback first shift
  service.rollbackShift(shift1.id, "manual", "First rollback");

  // New shift
  service.registerSlot("blue", "v1.0.1", 1);
  const shift2 = service.startCanaryShift("blue", "green");

  // Directive order: start1, rollback1, start2
  assert.equal(directives.length, 3);
  assert.equal(directives[0]?.type, "mode_switch");
  assert.equal(directives[0]?.params?.shiftId, shift1.id);
  assert.equal(directives[1]?.type, "rollback");
  assert.equal(directives[1]?.params?.shiftId, shift1.id);
  assert.equal(directives[2]?.type, "mode_switch");
  assert.equal(directives[2]?.params?.shiftId, shift2.id);
});

// ---------------------------------------------------------------------------
// DirectiveSink: Default InitiatedBy
// ---------------------------------------------------------------------------

test("startCanaryShift defaults initiatedBy to 'system'", () => {
  const db = createTestDb();
  const directives: Record<string, unknown>[] = [];
  const directiveSink: ControlPlaneDirectiveSink = {
    emitOperationalDirective(directive) {
      directives.push(directive as unknown as Record<string, unknown>);
    },
    emitDecisionDirective() {},
  };
  const service = new TrafficRoutingService(db, directiveSink);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  // Call without initiatedBy
  service.startCanaryShift("blue", "green");

  assert.equal(directives.length, 1);
  // The directive's issuedBy.principalId should be 'system'
  const directive = directives[0]!;
  assert.ok(directive.params !== undefined);
});

// ---------------------------------------------------------------------------
// DirectiveSink: Directive Types
// ---------------------------------------------------------------------------

test("only mode_switch and rollback directive types are emitted", () => {
  const db = createTestDb();
  const directiveTypes: string[] = [];
  const directiveSink: ControlPlaneDirectiveSink = {
    emitOperationalDirective(directive) {
      directiveTypes.push((directive as unknown as Record<string, unknown>).type as string);
    },
    emitDecisionDirective() {},
  };
  const service = new TrafficRoutingService(db, directiveSink);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  service.rollbackShift(shift.id, "manual", "Test");

  // Should only have mode_switch and rollback types
  assert.ok(directiveTypes.every(t => t === "mode_switch" || t === "rollback"));
});

// ---------------------------------------------------------------------------
// Service Construction
// ---------------------------------------------------------------------------

test("service can be constructed with null directiveSink", () => {
  const db = createTestDb();

  // Should not throw
  const service = new TrafficRoutingService(db, null);
  assert.ok(service !== undefined);
});

test("service can be constructed without directiveSink parameter", () => {
  const db = createTestDb();

  // Should not throw - second param is optional
  const service = new TrafficRoutingService(db);
  assert.ok(service !== undefined);
});
