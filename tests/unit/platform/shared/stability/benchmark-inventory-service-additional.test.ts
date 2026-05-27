/**
 * Unit tests for Benchmark Inventory Service Module.
 *
 * Tests the benchmark inventory functionality:
 * - List benchmarks
 * - Build summary statistics
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BenchmarkInventoryService,
  type BenchmarkInventoryRecord,
} from "../../../../../src/platform/shared/stability/benchmark-inventory-service.js";

test("BenchmarkInventoryService lists all benchmarks [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  assert.ok(benchmarks.length > 0);
  assert.ok(benchmarks.every((b) => b.benchmarkId.length > 0));
});

test("BenchmarkInventoryService benchmarks have valid architecture sections [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  assert.ok(benchmarks.every((b) => b.architectureSection.startsWith("§")));
});

test("BenchmarkInventoryService buildSummary computes correct totals [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.total, service.listBenchmarks().length);
  assert.ok(Object.keys(summary.bySection).length > 0);
  assert.ok(Object.keys(summary.byTargetScale).length > 0);
});

test("BenchmarkInventoryService buildSummary groups by section correctly [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  const section27 = summary.bySection["§27"];
  const section28 = summary.bySection["§28"];
  const section31 = summary.bySection["§31"];

  // Benchmarks are categorized by section
  assert.ok(section27 !== undefined || section28 !== undefined);
});

test("BenchmarkInventoryService buildSummary groups by targetScale correctly [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.ok(summary.byTargetScale["S1"] !== undefined);
  assert.ok(summary.byTargetScale["S2"] !== undefined);
  assert.ok(summary.byTargetScale["S3"] !== undefined);
  assert.ok(summary.byTargetScale["S4_contract_only"] !== undefined);
});

test("BenchmarkInventoryService benchmarks have valid categories [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const validCategories = ["performance", "stable_rehearsal", "quality_gate"];
  assert.ok(benchmarks.every((b) => validCategories.includes(b.category)));
});

test("BenchmarkInventoryService benchmarks have valid evidence artifacts [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  assert.ok(benchmarks.every((b) => b.evidenceArtifact.length > 0));
  assert.ok(benchmarks.every((b) => b.evidenceArtifact.startsWith("stable-")));
});

test("BenchmarkInventoryService benchmarks have valid readiness surfaces [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  assert.ok(benchmarks.every((b) => b.readinessSurface.length > 0));
});

test("BenchmarkInventoryService benchmarks have npm run commands [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  assert.ok(benchmarks.every((b) => b.command.startsWith("npm run ")));
});

test("BenchmarkInventoryService returns defensive copy of benchmarks [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks1 = service.listBenchmarks();
  const benchmarks2 = service.listBenchmarks();

  // Should be equal but not the same reference
  assert.deepEqual(benchmarks1, benchmarks2);
  assert.throws(() => {
    benchmarks1.push({ benchmarkId: "test" } as never);
  }, /not extensible/);
  assert.equal(service.listBenchmarks().length, benchmarks2.length);
});

test("BenchmarkInventoryRecord structure validation [benchmark-inventory-service-additional]", () => {
  const record: BenchmarkInventoryRecord = {
    benchmarkId: "bench.test",
    architectureSection: "§1",
    category: "quality_gate",
    command: "npm run test",
    targetScale: "S1",
    evidenceArtifact: "test-artifact",
    readinessSurface: "test-surface",
  };

  assert.equal(record.benchmarkId, "bench.test");
  assert.ok(record.architectureSection.startsWith("§"));
  assert.ok(["performance", "stable_rehearsal", "quality_gate"].includes(record.category));
  assert.ok(["S1", "S2", "S3", "S4_contract_only"].includes(record.targetScale));
});

test("BenchmarkInventoryService buildSummary S4_contract_only count is 1 [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.equal(summary.byTargetScale.S4_contract_only, 1);
});

test("BenchmarkInventoryService S2 scale is most common [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.ok(summary.byTargetScale.S2 >= summary.byTargetScale.S1);
  assert.ok(summary.byTargetScale.S2 >= summary.byTargetScale.S3);
});

test("BenchmarkInventoryService buildSummary all scale counts are non-negative [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  assert.ok(summary.byTargetScale.S1 >= 0);
  assert.ok(summary.byTargetScale.S2 >= 0);
  assert.ok(summary.byTargetScale.S3 >= 0);
  assert.ok(summary.byTargetScale.S4_contract_only >= 0);
});

test("BenchmarkInventoryService section counts are non-negative [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  for (const count of Object.values(summary.bySection)) {
    assert.ok(count >= 0);
  }
});

test("BenchmarkInventoryService sum of section counts equals total [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  const sectionSum = Object.values(summary.bySection).reduce((a, b) => a + b, 0);
  assert.equal(sectionSum, summary.total);
});

test("BenchmarkInventoryService sum of scale counts equals total [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  const scaleSum = Object.values(summary.byTargetScale).reduce((a, b) => a + b, 0);
  assert.equal(scaleSum, summary.total);
});

test("BenchmarkInventoryService each benchmark has unique ID [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const ids = benchmarks.map((b) => b.benchmarkId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, benchmarks.length);
});

test("BenchmarkInventoryService architecture sections match format [benchmark-inventory-service-additional]", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  for (const benchmark of benchmarks) {
    assert.ok(benchmark.architectureSection.match(/^§\d+$/), `Invalid section format: ${benchmark.architectureSection}`);
  }
});
