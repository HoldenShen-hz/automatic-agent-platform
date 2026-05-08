import test from "node:test";
import assert from "node:assert/strict";
import { newId } from "../../src/platform/contracts/types/ids.js";
import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessLoopInput,
} from "../../src/platform/orchestration/harness/index.js";
import { HarnessMemoryManager } from "../../src/platform/orchestration/harness/memory-manager.js";
import { ToolbeltAssembler } from "../../src/platform/orchestration/harness/toolbelt-assembler.js";
import { GuardrailEngine } from "../../src/platform/orchestration/harness/guardrails/guardrail-engine.js";
import { ContextAssembler } from "../../src/platform/orchestration/harness/context-assembler.js";
import { DurableHarnessService } from "../../src/platform/orchestration/harness/durable/durable-harness-service.js";

const createMockConstraintPack = (): ConstraintPack => ({
  policyIds: [],
  approvalMode: "none",
  autonomyMode: "manual",
  toolPolicy: { allowedTools: ["tool_a", "tool_b", "tool_c", "tool_d", "tool_e"] },
  risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
  output_policy: { requiredEvidence: ["evidence_1", "evidence_2"], redactSensitiveData: false },
  budget: {
    maxSteps: 300,
    maxDurationMs: 60000,
    maxCost: 100000,
  },
});

const createMockLoopInput = (overrides: Partial<HarnessLoopInput> = {}): HarnessLoopInput => ({
  taskId: newId("task"),
  domainId: newId("domain"),
  constraintPack: createMockConstraintPack(),
  plannerOutput: { plan: "test plan", steps: ["step1", "step2"] },
  generatorOutput: { result: "test result", artifacts: [] },
  evaluatorOutput: { evaluation: "passed", details: {} },
  evaluatorScore: 0.85,
  riskScore: 50,
  requestedTools: ["tool_a", "tool_b", "tool_c"],
  producedEvidenceRefs: ["evidence_1"],
  requiresHuman: false,
  iteration: 1,
  ...overrides,
});

test("HarnessRuntimeService createRun should handle 5000 calls at > 50000 ops/sec", () => {
  const service = new HarnessRuntimeService();
  const iterations = 5000;

  // Warm up
  for (let i = 0; i < 100; i++) {
    service.createRun({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
    });
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    service.createRun({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
    });
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 50000,
    `createRun throughput ${opsPerSec.toFixed(0)} ops/sec should be > 50000 ops/sec`,
  );
});

test("HarnessRuntimeService appendStep should handle 10000 calls at > 20000 ops/sec", () => {
  const service = new HarnessRuntimeService();
  let run = service.createRun({
    taskId: newId("task"),
    domainId: newId("domain"),
    constraintPack: createMockConstraintPack(),
  });

  // Warm up
  for (let i = 0; i < 100; i++) {
    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: {},
      outputs: {},
    });
  }

  // Reset with fresh run
  run = service.createRun({
    taskId: newId("task"),
    domainId: newId("domain"),
    constraintPack: createMockConstraintPack(),
  });

  const iterations = 10000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { stepIndex: i },
      outputs: { result: `output_${i}` },
    });
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 20000,
    `appendStep throughput ${opsPerSec.toFixed(0)} ops/sec should be > 20000 ops/sec`,
  );
});

test("HarnessRuntimeService createRun plus 10 appendStep chains should handle at > 5000 ops/sec", () => {
  const service = new HarnessRuntimeService();
  const iterations = 1000;
  const stepsPerRun = 10;

  // Warm up
  for (let i = 0; i < 10; i++) {
    let warmupRun = service.createRun({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
    });
    for (let j = 0; j < stepsPerRun; j++) {
      warmupRun = service.appendStep(warmupRun, {
        role: "planner",
        stage: "plan",
        inputs: {},
        outputs: {},
      });
    }
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    let run = service.createRun({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
    });
    for (let j = 0; j < stepsPerRun; j++) {
      run = service.appendStep(run, {
        role: "planner",
        stage: "plan",
        inputs: { stepIndex: j },
        outputs: { result: `output_${j}` },
      });
    }
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 5000,
    `createRun+appendStep chain throughput ${opsPerSec.toFixed(0)} ops/sec should be > 5000 ops/sec`,
  );
});

test("ContextAssembler should assemble context with small token budget at > 100000 ops/sec", () => {
  const assembler = new ContextAssembler();
  const iterations = 50000;

  const sources = {
    conversation: { messages: ["hello", "world"] },
    task: { taskId: "test", description: "simple task" },
    memory: { key: "value" },
    knowledge: { facts: ["fact1", "fact2"] },
  };

  // Warm up
  for (let i = 0; i < 100; i++) {
    assembler.assemble(sources, 1000);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    assembler.assemble(sources, 1000);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 100000,
    `assembleContext (small budget) throughput ${opsPerSec.toFixed(0)} ops/sec should be > 100000 ops/sec`,
  );
});

test("ContextAssembler should assemble context with large token budget at > 50000 ops/sec", () => {
  const assembler = new ContextAssembler();
  const iterations = 30000;

  // Large sources simulating real-world context
  const largeSources = {
    conversation: {
      messages: Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `This is message number ${i} with some additional content to simulate realistic conversation data`,
      })),
    },
    task: {
      taskId: "complex_task",
      description: "A complex task requiring extensive context",
      metadata: Array.from({ length: 20 }, (_, i) => ({ key: `meta_${i}`, value: `value_${i}` })),
    },
    memory: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`mem_key_${i}`, `mem_value_${i}`])),
    knowledge: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`know_key_${i}`, `know_value_${i}`])),
  };

  // Warm up
  for (let i = 0; i < 50; i++) {
    assembler.assemble(largeSources, 50000);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    assembler.assemble(largeSources, 50000);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 50000,
    `assembleContext (large budget) throughput ${opsPerSec.toFixed(0)} ops/sec should be > 50000 ops/sec`,
  );
});

test("ContextAssembler snapshot creation latency should be < 2000ns", () => {
  const assembler = new ContextAssembler();
  const service = new HarnessRuntimeService();
  const iterations = 30000;

  let run = service.createRun({
    taskId: newId("task"),
    domainId: newId("domain"),
    constraintPack: createMockConstraintPack(),
  });
  run = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: { result: "test" },
  });

  const context = assembler.assemble(
    { conversation: {}, task: {}, memory: {}, knowledge: {} },
    5000,
  );

  // Warm up
  for (let i = 0; i < 50; i++) {
    assembler.snapshot(run, context);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    assembler.snapshot(run, context);
  }
  const end = performance.now();

  const durationNs = (end - start) * 1_000_000;
  const avgLatencyNs = durationNs / iterations;

  assert.ok(
    avgLatencyNs < 2000,
    `snapshot avg latency ${avgLatencyNs.toFixed(2)}ns should be < 2000ns (2µs)`,
  );
});

test("HarnessMemoryManager should handle 50000 write operations at > 200000 ops/sec", () => {
  const manager = new HarnessMemoryManager();
  const iterations = 50000;
  const scopeId = "test_scope";

  // Warm up
  for (let i = 0; i < 100; i++) {
    manager.write("run", scopeId, `key_${i % 10}`, { data: i });
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    manager.write("run", scopeId, `key_${i % 100}`, { data: i, timestamp: Date.now() });
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 200000,
    `memory write throughput ${opsPerSec.toFixed(0)} ops/sec should be > 200000 ops/sec`,
  );
});

test("HarnessMemoryManager should handle 100000 read operations at > 500000 ops/sec", () => {
  const manager = new HarnessMemoryManager();
  const iterations = 100000;
  const scopeId = "test_scope";

  // Pre-populate
  for (let i = 0; i < 100; i++) {
    manager.write("run", scopeId, `key_${i}`, { data: i });
  }

  // Warm up
  for (let i = 0; i < 100; i++) {
    manager.read("run", scopeId, `key_${i % 100}`);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    manager.read("run", scopeId, `key_${i % 100}`);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 500000,
    `memory read throughput ${opsPerSec.toFixed(0)} ops/sec should be > 500000 ops/sec`,
  );
});

test("HarnessMemoryManager should handle 20000 list operations at > 100000 ops/sec", () => {
  const manager = new HarnessMemoryManager();
  const iterations = 20000;
  const scopeId = "test_scope";

  // Pre-populate with 50 entries
  for (let i = 0; i < 50; i++) {
    manager.write("run", scopeId, `key_${i}`, { data: i });
  }

  // Warm up
  for (let i = 0; i < 50; i++) {
    manager.list("run", scopeId);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    manager.list("run", scopeId);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 100000,
    `memory list throughput ${opsPerSec.toFixed(0)} ops/sec should be > 100000 ops/sec`,
  );
});

test("HarnessMemoryManager should handle mixed read/write workloads at > 100000 ops/sec", () => {
  const manager = new HarnessMemoryManager();
  const iterations = 50000;
  const scopeId = "test_scope";

  // Pre-populate
  for (let i = 0; i < 50; i++) {
    manager.write("run", scopeId, `key_${i}`, { data: i });
  }

  // Warm up
  for (let i = 0; i < 100; i++) {
    const idx = i % 50;
    manager.write("run", scopeId, `key_${idx}`, { data: idx, updated: true });
    manager.read("run", scopeId, `key_${idx}`);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const idx = i % 50;
    manager.write("run", scopeId, `key_${idx}`, { data: idx, iteration: i });
    manager.read("run", scopeId, `key_${idx}`);
  }
  const end = performance.now();

  // 2 operations per iteration (write + read)
  const totalOps = iterations * 2;
  const durationMs = end - start;
  const opsPerSec = (totalOps / durationMs) * 1000;

  assert.ok(
    opsPerSec > 100000,
    `mixed read/write throughput ${opsPerSec.toFixed(0)} ops/sec should be > 100000 ops/sec`,
  );
});

test("ToolbeltAssembler should assemble toolbelt with small tool list at > 500000 ops/sec", () => {
  const assembler = new ToolbeltAssembler();
  const iterations = 100000;

  const request = {
    allowedTools: ["tool_a", "tool_b", "tool_c", "tool_d", "tool_e"],
    requestedTools: ["tool_a", "tool_b", "tool_c"],
    requiredEvidence: ["evidence_1"],
  };

  // Warm up
  for (let i = 0; i < 100; i++) {
    assembler.assemble(request);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    assembler.assemble(request);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 500000,
    `toolbelt assemble (small) throughput ${opsPerSec.toFixed(0)} ops/sec should be > 500000 ops/sec`,
  );
});

test("ToolbeltAssembler should assemble toolbelt with large tool list at > 100000 ops/sec", () => {
  const assembler = new ToolbeltAssembler();
  const iterations = 50000;

  // Large tool list
  const allowedTools = Array.from({ length: 100 }, (_, i) => `tool_${i}`);
  const requestedTools = Array.from({ length: 50 }, (_, i) => `tool_${i * 2 % 100}`);

  const request = {
    allowedTools,
    requestedTools,
    requiredEvidence: ["evidence_1", "evidence_2", "evidence_3"],
  };

  // Warm up
  for (let i = 0; i < 50; i++) {
    assembler.assemble(request);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    assembler.assemble(request);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 100000,
    `toolbelt assemble (large) throughput ${opsPerSec.toFixed(0)} ops/sec should be > 100000 ops/sec`,
  );
});

test("GuardrailEngine should assess guardrails with no violations at > 200000 ops/sec", () => {
  const engine = new GuardrailEngine();
  const iterations = 80000;

  const input = {
    toolbelt: {
      allowedTools: ["tool_a", "tool_b", "tool_c"],
      grantedTools: ["tool_a", "tool_b"],
      blockedTools: [],
      requiredEvidence: ["evidence_1"],
    },
    evidenceRefs: ["evidence_1", "evidence_2"],
    riskScore: 30,
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 10,
    maxSteps: 300,
  };

  // Warm up
  for (let i = 0; i < 100; i++) {
    engine.assess(input);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    engine.assess(input);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 200000,
    `guardrail assess (pass) throughput ${opsPerSec.toFixed(0)} ops/sec should be > 200000 ops/sec`,
  );
});

test("GuardrailEngine should assess guardrails with blocked tools at > 150000 ops/sec", () => {
  const engine = new GuardrailEngine();
  const iterations = 50000;

  const input = {
    toolbelt: {
      allowedTools: ["tool_a", "tool_b"],
      grantedTools: ["tool_a"],
      blockedTools: ["tool_blocked_1", "tool_blocked_2"],
      requiredEvidence: ["evidence_1"],
    },
    evidenceRefs: ["evidence_1"],
    riskScore: 50,
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 50,
    maxSteps: 300,
  };

  // Warm up
  for (let i = 0; i < 100; i++) {
    engine.assess(input);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    engine.assess(input);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 150000,
    `guardrail assess (block) throughput ${opsPerSec.toFixed(0)} ops/sec should be > 150000 ops/sec`,
  );
});

test("GuardrailEngine should assess guardrails with high risk at > 150000 ops/sec", () => {
  const engine = new GuardrailEngine();
  const iterations = 50000;

  const input = {
    toolbelt: {
      allowedTools: ["tool_a", "tool_b", "tool_c"],
      grantedTools: ["tool_a", "tool_b", "tool_c"],
      blockedTools: [],
      requiredEvidence: ["evidence_1", "evidence_2"],
    },
    evidenceRefs: ["evidence_1"],
    riskScore: 95,
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 280,
    maxSteps: 300,
  };

  // Warm up
  for (let i = 0; i < 100; i++) {
    engine.assess(input);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    engine.assess(input);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 150000,
    `guardrail assess (high risk) throughput ${opsPerSec.toFixed(0)} ops/sec should be > 150000 ops/sec`,
  );
});

test("DurableHarnessService should persist runs at > 50000 ops/sec", () => {
  const service = new DurableHarnessService();
  const runtimeService = new HarnessRuntimeService({ durableService: service });
  const iterations = 30000;

  // Warm up
  for (let i = 0; i < 50; i++) {
    const run = runtimeService.createRun({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
    });
    service.persist(run);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const run = runtimeService.createRun({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
    });
    service.persist(run);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 50000,
    `durable persist throughput ${opsPerSec.toFixed(0)} ops/sec should be > 50000 ops/sec`,
  );
});

test("DurableHarnessService should restore runs at > 100000 ops/sec", () => {
  const service = new DurableHarnessService();
  const runtimeService = new HarnessRuntimeService({ durableService: service });
  const iterations = 50000;

  // Pre-populate with runs
  const runIds: string[] = [];
  for (let i = 0; i < 100; i++) {
    const run = runtimeService.createRun({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
    });
    service.persist(run);
    runIds.push(run.runId);
  }

  // Warm up
  for (let i = 0; i < 50; i++) {
    service.restore(runIds[i % 100]!);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    service.restore(runIds[i % 100]!);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 100000,
    `durable restore throughput ${opsPerSec.toFixed(0)} ops/sec should be > 100000 ops/sec`,
  );
});

test("DurableHarnessService should checkpoint and restore at > 20000 ops/sec", () => {
  const service = new DurableHarnessService();
  const runtimeService = new HarnessRuntimeService({ durableService: service });
  const iterations = 10000;

  // Warm up
  for (let i = 0; i < 20; i++) {
    let run = runtimeService.createRun({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
    });
    run = runtimeService.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: {},
      outputs: {},
    });
    const ref = service.checkpoint(run);
    service.restoreFromCheckpoint(ref);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    let run = runtimeService.createRun({
      taskId: newId("task"),
      domainId: newId("domain"),
      constraintPack: createMockConstraintPack(),
    });
    run = runtimeService.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: {},
      outputs: {},
    });
    const ref = service.checkpoint(run);
    service.restoreFromCheckpoint(ref);
  }
  const end = performance.now();

  // 3 operations per iteration (createRun + appendStep + checkpoint + restore = 4, but we count pairs)
  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 20000,
    `checkpoint+restore throughput ${opsPerSec.toFixed(0)} ops/sec should be > 20000 ops/sec`,
  );
});

test("HarnessRuntimeService should decide on evaluations at > 200000 ops/sec", () => {
  const service = new HarnessRuntimeService();
  const iterations = 100000;

  // Warm up
  for (let i = 0; i < 100; i++) {
    service.decide({ evaluatorScore: 0.8 });
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    service.decide({ evaluatorScore: 0.5 + (i % 50) / 100 });
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 200000,
    `decide throughput ${opsPerSec.toFixed(0)} ops/sec should be > 200000 ops/sec`,
  );
});

test("HarnessRuntimeService should assert invariants at > 100000 ops/sec", () => {
  const service = new HarnessRuntimeService();
  let run = service.createRun({
    taskId: newId("task"),
    domainId: newId("domain"),
    constraintPack: createMockConstraintPack(),
  });
  run = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: {},
  });

  const iterations = 50000;

  // Warm up
  for (let i = 0; i < 100; i++) {
    service.assertInvariants(run);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    service.assertInvariants(run);
  }
  const end = performance.now();

  const durationMs = end - start;
  const opsPerSec = (iterations / durationMs) * 1000;

  assert.ok(
    opsPerSec > 100000,
    `assertInvariants throughput ${opsPerSec.toFixed(0)} ops/sec should be > 100000 ops/sec`,
  );
});
