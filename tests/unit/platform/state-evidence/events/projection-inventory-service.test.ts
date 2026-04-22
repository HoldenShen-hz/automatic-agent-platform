import assert from "node:assert/strict";
import test from "node:test";

import { ProjectionInventoryService } from "../../../../../src/platform/state-evidence/events/projection-inventory-service.js";
import { EventReliabilityInventoryService } from "../../../../../src/platform/state-evidence/events/event-reliability-inventory-service.js";

test("ProjectionInventoryService lists all projections by default", () => {
  const service = new ProjectionInventoryService();
  const records = service.listProjectionInventory();

  assert.equal(records.length, 9);
  assert.ok(records.some((r) => r.projectionName === "task_summary"));
  assert.ok(records.some((r) => r.projectionName === "workflow_summary"));
  assert.ok(records.some((r) => r.projectionName === "approval_summary"));
  assert.ok(records.some((r) => r.projectionName === "division_summary"));
  assert.ok(records.some((r) => r.projectionName === "budget_summary"));
  assert.ok(records.some((r) => r.projectionName === "inspect_projection"));
  assert.ok(records.some((r) => r.projectionName === "feedback_summary"));
  assert.ok(records.some((r) => r.projectionName === "gateway_summary"));
  assert.ok(records.some((r) => r.projectionName === "observability_summary"));
});

test("ProjectionInventoryService all records have rebuildRequired true", () => {
  const service = new ProjectionInventoryService();
  const records = service.listProjectionInventory();

  assert.ok(records.every((r) => r.rebuildRequired === true));
});

test("ProjectionInventoryService buildSummary returns correct total", () => {
  const service = new ProjectionInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.total, 9);
});

test("ProjectionInventoryService buildSummary lists contract gaps", () => {
  const service = new ProjectionInventoryService();
  const summary = service.buildSummary();

  assert.ok(Array.isArray(summary.contractGaps));
  assert.ok(summary.contractGaps.includes("gateway_summary"));
});

test("ProjectionInventoryService uses provided EventReliabilityInventoryService", () => {
  const customEventService = new EventReliabilityInventoryService();
  const service = new ProjectionInventoryService(customEventService);

  const records = service.listProjectionInventory();
  assert.equal(records.length, 9);
});

test("ProjectionInventoryService constructor accepts undefined for optional dependency", () => {
  const service = new ProjectionInventoryService(undefined);
  const records = service.listProjectionInventory();

  assert.equal(records.length, 9);
});

test("ProjectionInventoryService listProjectionInventory returns consistent results", () => {
  const service = new ProjectionInventoryService();
  const first = service.listProjectionInventory();
  const second = service.listProjectionInventory();

  assert.equal(first.length, second.length);
  assert.deepEqual(first, second);
});

test("ProjectionInventoryService buildSummary is idempotent", () => {
  const service = new ProjectionInventoryService();
  const first = service.buildSummary();
  const second = service.buildSummary();

  assert.deepEqual(first, second);
});

test("ProjectionInventoryService projections have lagThresholdSeconds values", () => {
  const service = new ProjectionInventoryService();
  const records = service.listProjectionInventory();

  assert.ok(records.every((r) => typeof r.lagThresholdSeconds === "number"));
  assert.ok(records.every((r) => r.lagThresholdSeconds > 0));
});

test("ProjectionInventoryService projections have coverageStatus", () => {
  const service = new ProjectionInventoryService();
  const records = service.listProjectionInventory();

  const statuses = new Set(records.map((r) => r.coverageStatus));
  assert.ok(statuses.has("implemented") || statuses.has("contract_gap"));
});