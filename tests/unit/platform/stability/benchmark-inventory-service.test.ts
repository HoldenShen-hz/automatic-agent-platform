import assert from "node:assert/strict";
import test from "node:test";

import {
  BenchmarkInventoryService,
  BenchmarkInventoryRecord,
} from "../../../../src/platform/stability/benchmark-inventory-service.js";

test("BenchmarkInventoryService lists all default benchmarks", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  assert.ok(Array.isArray(benchmarks));
  assert.ok(benchmarks.length > 0);
});

test("BenchmarkInventoryService returns immutable benchmark records", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  // Records should be readonly
  assert.ok(Object.isFrozen(benchmarks));
});

test("BenchmarkInventoryService buildSummary returns correct total count", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();
  const summary = service.buildSummary();

  assert.equal(summary.total, benchmarks.length);
});

test("BenchmarkInventoryService buildSummary counts benchmarks by architecture section", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.ok(summary.bySection);
  assert.ok("§27" in summary.bySection);
  assert.ok("§28" in summary.bySection);
  assert.ok("§31" in summary.bySection);
  assert.ok("§32" in summary.bySection);
});

test("BenchmarkInventoryService buildSummary counts benchmarks by target scale", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.ok(summary.byTargetScale);
  assert.ok("S1" in summary.byTargetScale);
  assert.ok("S2" in summary.byTargetScale);
  assert.ok("S3" in summary.byTargetScale);
  assert.ok("S4_contract_only" in summary.byTargetScale);
});

test("BenchmarkInventoryService each benchmark has required fields", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  for (const benchmark of benchmarks) {
    assert.ok(typeof benchmark.benchmarkId === "string");
    assert.ok(typeof benchmark.architectureSection === "string");
    assert.ok(["performance", "stable_rehearsal", "quality_gate"].includes(benchmark.category));
    assert.ok(typeof benchmark.command === "string");
    assert.ok(["S1", "S2", "S3", "S4_contract_only"].includes(benchmark.targetScale));
    assert.ok(typeof benchmark.evidenceArtifact === "string");
    assert.ok(typeof benchmark.readinessSurface === "string");
  }
});

test("BenchmarkInventoryService benchmarks have valid categories", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const categories = benchmarks.map((b) => b.category);
  assert.ok(categories.includes("quality_gate"));
  assert.ok(categories.includes("stable_rehearsal"));
  assert.ok(categories.includes("performance"));
});

test("BenchmarkInventoryService benchmarks have valid target scales", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const targetScales = benchmarks.map((b) => b.targetScale);
  assert.ok(targetScales.includes("S1"));
  assert.ok(targetScales.includes("S2"));
  assert.ok(targetScales.includes("S3"));
  assert.ok(targetScales.includes("S4_contract_only"));
});

test("BenchmarkInventoryService buildSummary total matches bySection sum", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  const sectionSum = Object.values(summary.bySection).reduce((sum, count) => sum + count, 0);
  assert.equal(sectionSum, summary.total);
});

test("BenchmarkInventoryService buildSummary total matches byTargetScale sum", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  const scaleSum = Object.values(summary.byTargetScale).reduce((sum, count) => sum + count, 0);
  assert.equal(scaleSum, summary.total);
});

test("BenchmarkInventoryService benchmarks have unique IDs", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const ids = benchmarks.map((b) => b.benchmarkId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length);
});

test("BenchmarkInventoryService benchmark commands start with npm", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  for (const benchmark of benchmarks) {
    assert.ok(benchmark.command.startsWith("npm run "));
  }
});

test("BenchmarkInventoryService benchmarks cover multiple readiness surfaces", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const surfaces = benchmarks.map((b) => b.readinessSurface);
  assert.ok(surfaces.includes("runtime_baseline"));
  assert.ok(surfaces.includes("dispatch_capacity"));
  assert.ok(surfaces.includes("event_reliability"));
  assert.ok(surfaces.includes("queue_delivery"));
  assert.ok(surfaces.includes("ha_dr"));
  assert.ok(surfaces.includes("deployment_evidence"));
});

test("BenchmarkInventoryService returns copy of benchmarks not original", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks1 = service.listBenchmarks();
  const benchmarks2 = service.listBenchmarks();

  // Should be equal in value
  assert.deepEqual(benchmarks1, benchmarks2);
  // But not the same reference
  assert.notEqual(benchmarks1, benchmarks2);
});

test("BenchmarkInventoryRecord type is correctly structured", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const record: BenchmarkInventoryRecord = benchmarks[0];
  assert.equal(typeof record.benchmarkId, "string");
  assert.equal(typeof record.architectureSection, "string");
  assert.equal(typeof record.category, "string");
  assert.equal(typeof record.command, "string");
  assert.equal(typeof record.targetScale, "string");
  assert.equal(typeof record.evidenceArtifact, "string");
  assert.equal(typeof record.readinessSurface, "string");
});
