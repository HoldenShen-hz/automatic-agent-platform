import assert from "node:assert/strict";
import test from "node:test";

import { BenchmarkInventoryService } from "../../../../../src/platform/shared/stability/benchmark-inventory-service.js";

test("BenchmarkInventoryService lists all benchmarks", () => {
  const service = new BenchmarkInventoryService();
  const records = service.listBenchmarks();

  assert.equal(records.length, 6);
  assert.ok(records.some((r) => r.benchmarkId === "bench.runtime.validator"));
  assert.ok(records.some((r) => r.benchmarkId === "bench.dispatch.rehearsal"));
  assert.ok(records.some((r) => r.benchmarkId === "bench.event.replay"));
  assert.ok(records.some((r) => r.benchmarkId === "bench.queue.delivery"));
  assert.ok(records.some((r) => r.benchmarkId === "bench.failover.drill"));
  assert.ok(records.some((r) => r.benchmarkId === "bench.evidence.campaign"));
});

test("BenchmarkInventoryService listBenchmarks returns a copy", () => {
  const service = new BenchmarkInventoryService();
  const first = service.listBenchmarks();
  const second = service.listBenchmarks();

  assert.notEqual(first, second);
  assert.throws(() => {
    first.push({ benchmarkId: "injected" } as never);
  }, /not extensible/);
  assert.equal(second.length, 6);
});

test("BenchmarkInventoryService buildSummary returns correct total", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.total, 6);
});

test("BenchmarkInventoryService buildSummary groups by architecture section", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.bySection["§27"], 2);
  assert.equal(summary.bySection["§28"], 2);
  assert.equal(summary.bySection["§31"], 1);
  assert.equal(summary.bySection["§32"], 1);
});

test("BenchmarkInventoryService buildSummary groups by target scale", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.byTargetScale.S1, 1);
  assert.equal(summary.byTargetScale.S2, 3);
  assert.equal(summary.byTargetScale.S3, 1);
  assert.equal(summary.byTargetScale.S4_contract_only, 1);
});

test("BenchmarkInventoryService buildSummary returns zero counts for missing scales", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.byTargetScale.S1, 1);
});

test("BenchmarkInventoryService buildSummary is idempotent", () => {
  const service = new BenchmarkInventoryService();
  const first = service.buildSummary();
  const second = service.buildSummary();

  assert.deepEqual(first, second);
});

test("BenchmarkInventoryService categories include performance, stable_rehearsal, and quality_gate", () => {
  const service = new BenchmarkInventoryService();
  const records = service.listBenchmarks();

  const categories = new Set(records.map((r) => r.category));
  assert.ok(categories.has("performance"));
  assert.ok(categories.has("stable_rehearsal"));
  assert.ok(categories.has("quality_gate"));
});
