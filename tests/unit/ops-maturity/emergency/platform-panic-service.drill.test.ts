/**
 * Unit tests for PlatformPanicService drill lifecycle
 *
 * @see src/ops-maturity/emergency/platform-panic-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  PlatformPanicService,
  type PanicActivationRequest,
  type PanicDrillRequest,
} from "../../../../../src/ops-maturity/emergency/platform-panic-service.js";

function createTestService() {
  return new PlatformPanicService();
}

function createActivationRequest(overrides: Partial<PanicActivationRequest> = {}): PanicActivationRequest {
  return {
    scope: "platform",
    reasonCode: "security.incident",
    activeIncidents: 1,
    issuedBy: "operator-1",
    requiredApprovers: ["platform-admin-1", "platform-admin-2"],
    ...overrides,
  };
}

test.describe("PlatformPanicService drill lifecycle", () => {
  test.describe("startDrill", () => {
    test("starts a drill with required fields", () => {
      const service = createTestService();
      const request: PanicDrillRequest = {
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
      };

      const record = service.startDrill(request);

      assert.ok(record.drillId);
      assert.equal(record.scope, "platform");
      assert.equal(record.scopeLevel, "platform");
      assert.equal(record.status, "in_progress");
      assert.equal(record.drillType, "scheduled");
      assert.equal(record.initiatedBy, "operator-1");
      assert.ok(record.initiatedAt);
      assert.equal(record.completedAt, null);
      assert.equal(record.directiveId, null);
    });

    test("starts a drill with custom freeze modes", () => {
      const service = createTestService();
      const request: PanicDrillRequest = {
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "manual",
        freezeModesTested: ["deploy", "write"],
      };

      const record = service.startDrill(request);

      assert.deepStrictEqual(record.freezeModesTested, ["deploy", "write"]);
    });

    test("starts a drill with custom target planes", () => {
      const service = createTestService();
      const request: PanicDrillRequest = {
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "simulation",
        targetPlanes: ["P1", "P3", "P5"],
      };

      const record = service.startDrill(request);

      assert.deepStrictEqual(record.targetPlanes, ["P1", "P3", "P5"]);
      assert.equal(record.acknowledgmentsExpected, 3);
    });

    test("starts a drill with default target planes", () => {
      const service = createTestService();
      const request: PanicDrillRequest = {
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
      };

      const record = service.startDrill(request);

      assert.deepStrictEqual(record.targetPlanes, ["P1", "P2", "P3", "P4", "P5"]);
      assert.equal(record.acknowledgmentsExpected, 5);
    });

    test("starts a drill with notes and traceId", () => {
      const service = createTestService();
      const request: PanicDrillRequest = {
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "manual",
        notes: "Test drill notes",
        traceId: "trace-123",
      };

      const record = service.startDrill(request);

      assert.equal(record.notes, "Test drill notes");
      assert.equal(record.traceId, "trace-123");
    });

    test("starts a drill with directiveId", () => {
      const service = createTestService();
      const request: PanicDrillRequest = {
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
        directiveId: "directive-123",
      };

      const record = service.startDrill(request);

      assert.equal(record.directiveId, "directive-123");
    });

    test("derives scope level from scope string", () => {
      const service = createTestService();

      const record1 = service.startDrill({
        scope: "region/us-east",
        initiatedBy: "operator-1",
        drillType: "manual",
      });
      assert.equal(record1.scopeLevel, "region");

      const record2 = service.startDrill({
        scope: "tenant/acme-corp",
        initiatedBy: "operator-1",
        drillType: "manual",
      });
      assert.equal(record2.scopeLevel, "tenant");

      const record3 = service.startDrill({
        scope: "domain/payments",
        initiatedBy: "operator-1",
        drillType: "manual",
      });
      assert.equal(record3.scopeLevel, "domain");

      const record4 = service.startDrill({
        scope: "run/execution-123",
        initiatedBy: "operator-1",
        drillType: "manual",
      });
      assert.equal(record4.scopeLevel, "run");

      const record5 = service.startDrill({
        scope: "node/worker-1",
        initiatedBy: "operator-1",
        drillType: "manual",
      });
      assert.equal(record5.scopeLevel, "node");
    });

    test("stores drill in service for later retrieval", () => {
      const service = createTestService();
      const request: PanicDrillRequest = {
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
      };

      const record = service.startDrill(request);
      const drills = service.listDrills();

      assert.equal(drills.length, 1);
      assert.equal(drills[0]?.drillId, record.drillId);
    });

    test("multiple drills are stored independently", () => {
      const service = createTestService();
      const drill1 = service.startDrill({
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
      });
      const drill2 = service.startDrill({
        scope: "region/us-east",
        initiatedBy: "operator-2",
        drillType: "manual",
      });

      const drills = service.listDrills();

      assert.equal(drills.length, 2);
    });

    test("default freeze modes for drill when not specified", () => {
      const service = createTestService();
      const request: PanicDrillRequest = {
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
      };

      const record = service.startDrill(request);

      assert.deepStrictEqual(record.freezeModesTested, ["deploy", "automation"]);
    });
  });

  test.describe("completeDrill", () => {
    test("completes drill with status completed", () => {
      const service = createTestService();
      const started = service.startDrill({
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
        targetPlanes: ["P1", "P2", "P3"],
      });

      const completed = service.completeDrill(started.drillId, {
        status: "completed",
        acknowledgmentsReceived: 3,
      });

      assert.equal(completed.status, "completed");
      assert.equal(completed.acknowledgmentsReceived, 3);
      assert.ok(completed.completedAt);
    });

    test("completes drill with status cancelled", () => {
      const service = createTestService();
      const started = service.startDrill({
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "manual",
      });

      const completed = service.completeDrill(started.drillId, {
        status: "cancelled",
        acknowledgmentsReceived: 0,
      });

      assert.equal(completed.status, "cancelled");
    });

    test("completes drill with status failed", () => {
      const service = createTestService();
      const started = service.startDrill({
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "simulation",
      });

      const completed = service.completeDrill(started.drillId, {
        status: "failed",
        acknowledgmentsReceived: 2,
      });

      assert.equal(completed.status, "failed");
    });

    test("completes drill with findingsJson", () => {
      const service = createTestService();
      const started = service.startDrill({
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
      });

      const completed = service.completeDrill(started.drillId, {
        status: "completed",
        acknowledgmentsReceived: 5,
        findingsJson: '{"issues":["found-1"],"recommendations":["fix-1"]}',
      });

      assert.ok(completed.findingsJson);
    });

    test("completes drill with updated notes", () => {
      const service = createTestService();
      const started = service.startDrill({
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
        notes: "Initial notes",
      });

      const completed = service.completeDrill(started.drillId, {
        status: "completed",
        acknowledgmentsReceived: 5,
        notes: "Updated notes after drill",
      });

      assert.equal(completed.notes, "Updated notes after drill");
    });

    test("throws when completing unknown drill", () => {
      const service = createTestService();

      assert.throws(
        () => service.completeDrill("unknown-drill-id", {
          status: "completed",
          acknowledgmentsReceived: 0,
        }),
        (err: Error) => err.message.includes("panic.drill_not_found"),
      );
    });

    test("preserves existing findingsJson when not overridden", () => {
      const service = createTestService();
      const started = service.startDrill({
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
      });

      service.completeDrill(started.drillId, {
        status: "completed",
        acknowledgmentsReceived: 5,
        findingsJson: '{"initial":"findings"}',
      });

      const secondCompletion = service.completeDrill(started.drillId, {
        status: "completed",
        acknowledgmentsReceived: 5,
      });

      assert.equal(secondCompletion.findingsJson, '{"initial":"findings"}');
    });

    test("preserves existing notes when not overridden", () => {
      const service = createTestService();
      const started = service.startDrill({
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
        notes: "Drill notes",
      });

      service.completeDrill(started.drillId, {
        status: "completed",
        acknowledgmentsReceived: 5,
        notes: "Override notes",
      });

      const secondCompletion = service.completeDrill(started.drillId, {
        status: "completed",
        acknowledgmentsReceived: 5,
      });

      assert.equal(secondCompletion.notes, "Override notes");
    });
  });

  test.describe("listDrills", () => {
    test("returns empty array when no drills started", () => {
      const service = createTestService();

      const drills = service.listDrills();

      assert.deepStrictEqual(drills, []);
    });

    test("returns drills sorted by initiatedAt", () => {
      const service = createTestService();
      const drill1 = service.startDrill({
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
      });

      // Manually set initiatedAt to simulate earlier time
      const drill2 = service.startDrill({
        scope: "region/us-east",
        initiatedBy: "operator-2",
        drillType: "manual",
      });

      const drills = service.listDrills();

      // Should be sorted by initiatedAt
      assert.ok(drills[0]?.initiatedAt <= drills[1]?.initiatedAt);
    });

    test("returns completed drills with completedAt set", () => {
      const service = createTestService();
      const started = service.startDrill({
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "scheduled",
      });

      service.completeDrill(started.drillId, {
        status: "completed",
        acknowledgmentsReceived: 5,
      });

      const drills = service.listDrills();

      assert.ok(drills[0]?.completedAt);
    });
  });

  test.describe("drill with panic directive", () => {
    test("drill can be linked to existing panic directive", () => {
      const service = createTestService();
      const activation = service.activate(createActivationRequest());

      const drill = service.startDrill({
        scope: "platform",
        initiatedBy: "operator-1",
        drillType: "simulation",
        directiveId: activation.directive.directiveId,
      });

      assert.equal(drill.directiveId, activation.directive.directiveId);
    });
  });
});