import assert from "node:assert/strict";
import test from "node:test";

import * as learning from "../../../../src/ops-maturity/learning/index.js";
import { EvolutionIntegrationService, DEFAULT_CONFIG } from "../../../../src/ops-maturity/drift-detection/evolution-integration-service.js";
import { SimpleBenchmarkRunner } from "../../../../src/ops-maturity/drift-detection/learning/benchmark-runner.js";
import { InMemoryEvidenceStore } from "../../../../src/ops-maturity/drift-detection/learning/evidence-store.js";
import { SimpleReflectionEngine } from "../../../../src/ops-maturity/drift-detection/learning/reflection-engine.js";

test("ops-maturity learning barrel re-exports evolution and learning services", () => {
  assert.equal(learning.EvolutionIntegrationService, EvolutionIntegrationService);
  assert.equal(learning.DEFAULT_CONFIG, DEFAULT_CONFIG);
  assert.equal(learning.SimpleBenchmarkRunner, SimpleBenchmarkRunner);
  assert.equal(learning.InMemoryEvidenceStore, InMemoryEvidenceStore);
  assert.equal(learning.SimpleReflectionEngine, SimpleReflectionEngine);
});

test("ops-maturity learning barrel exports remain constructible", () => {
  const evidenceStore = new learning.InMemoryEvidenceStore();
  const reflectionEngine = new learning.SimpleReflectionEngine();
  const benchmarkRunner = new learning.SimpleBenchmarkRunner();

  assert.equal(typeof evidenceStore.append, "function");
  assert.equal(typeof reflectionEngine.reflect, "function");
  assert.equal(typeof benchmarkRunner.evaluate, "function");
  assert.equal(typeof benchmarkRunner.runBenchmarks, "function");
});
