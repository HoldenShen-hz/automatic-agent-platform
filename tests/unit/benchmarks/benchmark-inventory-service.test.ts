import test from "node:test";
import assert from "node:assert/strict";
import {
  BenchmarkInventoryService,
  type BenchmarkInventoryRecord,
} from "../../../src/platform/shared/stability/benchmark-inventory-service.js";

test("BenchmarkInventoryService.listBenchmarks returns all benchmark records", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  assert.ok(Array.isArray(benchmarks));
  assert.strictEqual(benchmarks.length, 6);
});

test("BenchmarkInventoryService.listBenchmarks returns frozen records", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const first = benchmarks[0];
  assert.ok(Object.isFrozen(first));
});

test("BenchmarkInventoryService.listBenchmarks returns frozen array", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  assert.ok(Object.isFrozen(benchmarks));
});

test("BenchmarkInventoryService.listBenchmarks contains expected benchmark IDs", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const ids = benchmarks.map((b) => b.benchmarkId);
  assert.ok(ids.includes("bench.runtime.validator"));
  assert.ok(ids.includes("bench.dispatch.rehearsal"));
  assert.ok(ids.includes("bench.event.replay"));
  assert.ok(ids.includes("bench.queue.delivery"));
  assert.ok(ids.includes("bench.failover.drill"));
  assert.ok(ids.includes("bench.evidence.campaign"));
});

test("BenchmarkInventoryService.listBenchmarks contains valid category values", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const validCategories: BenchmarkInventoryRecord["category"][] = [
    "performance",
    "stable_rehearsal",
    "quality_gate",
  ];

  for (const benchmark of benchmarks) {
    assert.ok(
      validCategories.includes(benchmark.category),
      `Invalid category: ${benchmark.category}`,
    );
  }
});

test("BenchmarkInventoryService.listBenchmarks contains valid targetScale values", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const validScales: BenchmarkInventoryRecord["targetScale"][] = [
    "S1",
    "S2",
    "S3",
    "S4_contract_only",
  ];

  for (const benchmark of benchmarks) {
    assert.ok(
      validScales.includes(benchmark.targetScale),
      `Invalid targetScale: ${benchmark.targetScale}`,
    );
  }
});

test("BenchmarkInventoryService.listBenchmarks records have required fields", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  for (const benchmark of benchmarks) {
    assert.ok(typeof benchmark.benchmarkId === "string");
    assert.ok(typeof benchmark.architectureSection === "string");
    assert.ok(typeof benchmark.category === "string");
    assert.ok(typeof benchmark.command === "string");
    assert.ok(typeof benchmark.targetScale === "string");
    assert.ok(typeof benchmark.evidenceArtifact === "string");
    assert.ok(typeof benchmark.readinessSurface === "string");
  }
});

test("BenchmarkInventoryService.buildSummary returns correct total count", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.strictEqual(summary.total, 6);
});

test("BenchmarkInventoryService.buildSummary returns correct bySection breakdown", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.strictEqual(summary.bySection["§27"], 2); // runtime.validator, dispatch.rehearsal
  assert.strictEqual(summary.bySection["§28"], 2); // event.replay, queue.delivery
  assert.strictEqual(summary.bySection["§31"], 1); // failover.drill
  assert.strictEqual(summary.bySection["§32"], 1); // evidence.campaign
});

test("BenchmarkInventoryService.buildSummary returns correct byTargetScale breakdown", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.strictEqual(summary.byTargetScale["S1"], 1);
  assert.strictEqual(summary.byTargetScale["S2"], 3);
  assert.strictEqual(summary.byTargetScale["S3"], 1);
  assert.strictEqual(summary.byTargetScale["S4_contract_only"], 1);
});

test("BenchmarkInventoryService.buildSummary includes all target scales with zero counts", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.strictEqual(summary.byTargetScale["S1"], 1);
  assert.strictEqual(summary.byTargetScale["S2"], 3);
  assert.strictEqual(summary.byTargetScale["S3"], 1);
  assert.strictEqual(summary.byTargetScale["S4_contract_only"], 1);
});

test("BenchmarkInventoryService buildSummary returns correct bySection type", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.ok(typeof summary.bySection === "object");
  assert.ok(!Array.isArray(summary.bySection));
});

test("BenchmarkInventoryService buildSummary returns bySection with string keys", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  for (const [key, value] of Object.entries(summary.bySection)) {
    assert.ok(typeof key === "string");
    assert.ok(key.startsWith("§"));
    assert.ok(typeof value === "number");
  }
});

test("BenchmarkInventoryService records are deeply immutable", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();
  const first = benchmarks[0];
  assert.ok(first, "Expected at least one benchmark");
  // The record itself should be frozen to prevent modification
  assert.ok(Object.isFrozen(first), "Benchmark record should be frozen");
  // Verify all property values are primitives (strings) which are immutable by nature
  const values = Object.values(first);
  for (const value of values) {
    assert.ok(typeof value === "string", "All property values should be strings");
  }
});

test("BenchmarkInventoryService multiple calls return independent arrays", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks1 = service.listBenchmarks();
  const benchmarks2 = service.listBenchmarks();

  assert.notStrictEqual(benchmarks1, benchmarks2);
  assert.notStrictEqual(benchmarks1[0], benchmarks2[0]);
});
