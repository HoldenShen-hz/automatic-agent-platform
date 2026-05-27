import assert from "node:assert/strict";
import test from "node:test";

import { ProjectionRebuildWorker } from "../../../../../src/platform/five-plane-execution/ha/projection-rebuild-worker.js";

test("ProjectionRebuildWorker.getWorkerId returns default worker id [projection-rebuild-worker]", () => {
  const worker = new ProjectionRebuildWorker({
    projectionRebuildService: {
      rebuildAll: () => new Map(),
    },
  });

  assert.equal(worker.getWorkerId(), "projection-rebuild-worker");
});

test("ProjectionRebuildWorker.getWorkerId returns custom worker id [projection-rebuild-worker]", () => {
  const worker = new ProjectionRebuildWorker({
    projectionRebuildService: {
      rebuildAll: () => new Map(),
    },
    workerId: "custom-rebuild-worker",
  });

  assert.equal(worker.getWorkerId(), "custom-rebuild-worker");
});

test("ProjectionRebuildWorker.getRecoveryCadence returns configured cadence [projection-rebuild-worker]", () => {
  const worker = new ProjectionRebuildWorker({
    projectionRebuildService: {
      rebuildAll: () => new Map(),
    },
    cadence: {
      intervalMs: 60_000,
      maxConcurrent: 2,
      priority: "high" as const,
    },
  });

  const cadence = worker.getRecoveryCadence();
  assert.equal(cadence.intervalMs, 60_000);
  assert.equal(cadence.maxConcurrent, 2);
  assert.equal(cadence.priority, "high");
});

test("ProjectionRebuildWorker.runRecoveryCycle processes projections [projection-rebuild-worker]", async () => {
  const worker = new ProjectionRebuildWorker({
    projectionRebuildService: {
      rebuildAll: () => new Map([
        ["projection-a", { eventsProcessed: 10, projectionsUpdated: 5, eventsSkipped: 2, errors: [] }],
        ["projection-b", { eventsProcessed: 20, projectionsUpdated: 8, eventsSkipped: 1, errors: [] }],
      ]),
    },
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerType, "projection_rebuild");
  assert.equal(report.itemsProcessed, 30); // 10 + 20
  assert.equal(report.itemsRecovered, 13); // 5 + 8
  assert.equal(report.errors.length, 0);
  assert.equal(report.metadata.projectionCount, 2);
});

test("ProjectionRebuildWorker.runRecoveryCycle with no projections [projection-rebuild-worker]", async () => {
  const worker = new ProjectionRebuildWorker({
    projectionRebuildService: {
      rebuildAll: () => new Map(),
    },
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerType, "projection_rebuild");
  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.equal(report.errors.length, 0);
});

test("ProjectionRebuildWorker.runRecoveryCycle handles errors gracefully [projection-rebuild-worker]", async () => {
  const worker = new ProjectionRebuildWorker({
    projectionRebuildService: {
      rebuildAll: () => {
        throw new Error("Projection rebuild failed");
      },
    },
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerType, "projection_rebuild");
  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0]!.code, "projection_rebuild.cycle_failed");
});

test("ProjectionRebuildWorker.runRecoveryCycle handles projection errors [projection-rebuild-worker]", async () => {
  const worker = new ProjectionRebuildWorker({
    projectionRebuildService: {
      rebuildAll: () => new Map([
        ["projection-a", { eventsProcessed: 10, projectionsUpdated: 5, eventsSkipped: 2, errors: [] }],
        ["projection-b", { eventsProcessed: 0, projectionsUpdated: 0, eventsSkipped: 0, errors: ["read error"] }],
      ]),
    },
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerType, "projection_rebuild");
  assert.equal(report.itemsProcessed, 10);
  assert.equal(report.itemsRecovered, 5);
  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0]!.message, "read error");
});

test("ProjectionRebuildWorker.runRecoveryCycle includes metadata [projection-rebuild-worker]", async () => {
  const worker = new ProjectionRebuildWorker({
    projectionRebuildService: {
      rebuildAll: () => new Map([
        ["projection-a", { eventsProcessed: 10, projectionsUpdated: 5, eventsSkipped: 2, errors: [] }],
      ]),
    },
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.metadata.projectionCount, 1);
  assert.ok(report.metadata.projections["projection-a"]);
  assert.equal(report.metadata.projections["projection-a"].eventsProcessed, 10);
  assert.equal(report.metadata.projections["projection-a"].projectionsUpdated, 5);
  assert.equal(report.metadata.projections["projection-a"].eventsSkipped, 2);
});

test("ProjectionRebuildWorker.runRecoveryCycle with rebuild options [projection-rebuild-worker]", async () => {
  const worker = new ProjectionRebuildWorker({
    projectionRebuildService: {
      rebuildAll: (options) => {
        assert.deepEqual(options, { dryRun: true, limit: 100 });
        return new Map();
      },
    },
    rebuildOptions: { dryRun: true, limit: 100 },
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();
  assert.equal(report.itemsProcessed, 0);
});
