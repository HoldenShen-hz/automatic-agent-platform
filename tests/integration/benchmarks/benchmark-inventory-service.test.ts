import test from "node:test";
import assert from "node:assert/strict";
import {
  BenchmarkInventoryService,
  type BenchmarkInventoryRecord,
} from "../../../src/platform/shared/stability/benchmark-inventory-service.js";

test("BenchmarkInventoryService integration: full lifecycle with multiple service instances", () => {
  const service1 = new BenchmarkInventoryService();
  const service2 = new BenchmarkInventoryService();

  const benchmarks1 = service1.listBenchmarks();
  const benchmarks2 = service2.listBenchmarks();

  assert.strictEqual(benchmarks1.length, benchmarks2.length);
  assert.strictEqual(benchmarks1.length, 6);
});

test("BenchmarkInventoryService integration: buildSummary consistency across calls", () => {
  const service = new BenchmarkInventoryService();

  const summary1 = service.buildSummary();
  const summary2 = service.buildSummary();

  assert.deepStrictEqual(summary1, summary2);
});

test("BenchmarkInventoryService integration: verify all quality_gate benchmarks", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const qualityGates = benchmarks.filter((b) => b.category === "quality_gate");
  assert.strictEqual(qualityGates.length, 1);
  assert.strictEqual(qualityGates[0]!.benchmarkId, "bench.runtime.validator");
});

test("BenchmarkInventoryService integration: verify all stable_rehearsal benchmarks", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const stableRehearsals = benchmarks.filter((b) => b.category === "stable_rehearsal");
  assert.strictEqual(stableRehearsals.length, 4);

  const ids = stableRehearsals.map((b) => b.benchmarkId);
  assert.ok(ids.includes("bench.dispatch.rehearsal"));
  assert.ok(ids.includes("bench.event.replay"));
  assert.ok(ids.includes("bench.queue.delivery"));
  assert.ok(ids.includes("bench.failover.drill"));
});

test("BenchmarkInventoryService integration: verify all performance benchmarks", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const performance = benchmarks.filter((b) => b.category === "performance");
  assert.strictEqual(performance.length, 1);
  assert.strictEqual(performance[0]!.benchmarkId, "bench.evidence.campaign");
});

test("BenchmarkInventoryService integration: verify S1 scale benchmarks", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const s1Benchmarks = benchmarks.filter((b) => b.targetScale === "S1");
  assert.strictEqual(s1Benchmarks.length, 1);
  assert.strictEqual(s1Benchmarks[0]!.benchmarkId, "bench.runtime.validator");
});

test("BenchmarkInventoryService integration: verify S2 scale benchmarks", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const s2Benchmarks = benchmarks.filter((b) => b.targetScale === "S2");
  assert.strictEqual(s2Benchmarks.length, 3);

  const ids = s2Benchmarks.map((b) => b.benchmarkId);
  assert.ok(ids.includes("bench.dispatch.rehearsal"));
  assert.ok(ids.includes("bench.event.replay"));
  assert.ok(ids.includes("bench.queue.delivery"));
});

test("BenchmarkInventoryService integration: verify S3 scale benchmarks", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const s3Benchmarks = benchmarks.filter((b) => b.targetScale === "S3");
  assert.strictEqual(s3Benchmarks.length, 1);
  assert.strictEqual(s3Benchmarks[0]!.benchmarkId, "bench.failover.drill");
});

test("BenchmarkInventoryService integration: verify S4_contract_only scale benchmarks", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const s4Benchmarks = benchmarks.filter((b) => b.targetScale === "S4_contract_only");
  assert.strictEqual(s4Benchmarks.length, 1);
  assert.strictEqual(s4Benchmarks[0]!.benchmarkId, "bench.evidence.campaign");
});

test("BenchmarkInventoryService integration: verify architecture section distribution", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const section27 = benchmarks.filter((b) => b.architectureSection === "§27");
  const section28 = benchmarks.filter((b) => b.architectureSection === "§28");
  const section31 = benchmarks.filter((b) => b.architectureSection === "§31");
  const section32 = benchmarks.filter((b) => b.architectureSection === "§32");

  assert.strictEqual(section27.length, 2); // runtime.validator, dispatch.rehearsal
  assert.strictEqual(section28.length, 2); // event.replay, queue.delivery
  assert.strictEqual(section31.length, 1); // failover.drill
  assert.strictEqual(section32.length, 1); // evidence.campaign
});

test("BenchmarkInventoryService integration: verify readiness surfaces", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const readinessSurfaces = benchmarks.map((b) => b.readinessSurface);

  assert.ok(readinessSurfaces.includes("runtime_baseline"));
  assert.ok(readinessSurfaces.includes("dispatch_capacity"));
  assert.ok(readinessSurfaces.includes("event_reliability"));
  assert.ok(readinessSurfaces.includes("queue_delivery"));
  assert.ok(readinessSurfaces.includes("ha_dr"));
  assert.ok(readinessSurfaces.includes("deployment_evidence"));
});

test("BenchmarkInventoryService integration: verify evidence artifacts", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const artifacts = benchmarks.map((b) => b.evidenceArtifact);

  assert.ok(artifacts.includes("stable-runtime-validator"));
  assert.ok(artifacts.includes("stable-dispatch-rehearsal"));
  assert.ok(artifacts.includes("stable-event-replay-rehearsal"));
  assert.ok(artifacts.includes("stable-queue-delivery-rehearsal"));
  assert.ok(artifacts.includes("stable-cross-division-recovery-drill"));
  assert.ok(artifacts.includes("stable-evidence-campaign"));
});

test("BenchmarkInventoryService integration: verify commands are valid npm scripts", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  for (const benchmark of benchmarks) {
    assert.ok(benchmark.command.startsWith("npm run "));
  }
});

test("BenchmarkInventoryService integration: buildSummary total matches benchmarks count", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();
  const summary = service.buildSummary();

  assert.strictEqual(summary.total, benchmarks.length);
});

test("BenchmarkInventoryService integration: buildSummary bySection total equals benchmarks count", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  const sectionTotal = Object.values(summary.bySection).reduce((sum, count) => sum + count, 0);
  assert.strictEqual(sectionTotal, summary.total);
});

test("BenchmarkInventoryService integration: buildSummary byTargetScale total equals benchmarks count", () => {
  const service = new BenchmarkInventoryService();
  const summary = service.buildSummary();

  const scaleTotal = Object.values(summary.byTargetScale).reduce((sum, count) => sum + count, 0);
  assert.strictEqual(scaleTotal, summary.total);
});

test("BenchmarkInventoryService integration: each benchmark has unique benchmarkId", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  const ids = benchmarks.map((b) => b.benchmarkId);
  const uniqueIds = new Set(ids);

  assert.strictEqual(uniqueIds.size, ids.length);
});

test("BenchmarkInventoryService integration: benchmark records maintain data integrity", () => {
  const service = new BenchmarkInventoryService();
  const benchmarks = service.listBenchmarks();

  for (const benchmark of benchmarks) {
    assert.ok(benchmark.benchmarkId.length > 0);
    assert.ok(benchmark.architectureSection.length > 0);
    assert.ok(benchmark.command.length > 0);
    assert.ok(benchmark.evidenceArtifact.length > 0);
    assert.ok(benchmark.readinessSurface.length > 0);
  }
});
