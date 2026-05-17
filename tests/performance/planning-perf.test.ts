/**
 * Performance Test: Plan Builder
 * G4 Benchmark — plan-builder.build() P99 < 50ms
 *
 * Design target: Planning <50ms P99 (§7.4)
 */

import assert from "node:assert/strict";
import test from "node:test";
import { newId } from "../../src/platform/contracts/types/ids.js";
import { PlanBuilder } from "../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import type { TaskSituation } from "../../src/platform/five-plane-orchestration/oapeflir/types/task-situation.js";
import type { UnifiedAssessment } from "../../src/platform/five-plane-orchestration/oapeflir/types/unified-assessment.js";
import type { PlannedWorkflow } from "../../src/platform/five-plane-orchestration/routing/workflow-planner.js";

function createMinimalTaskSituation(): TaskSituation {
  return {
    taskId: newId("task"),
    timestamp: Date.now(),
    objective: "build feature",
    currentPhase: "planning",
    userIntent: {
      raw: "build feature",
      normalized: "build feature",
      confidence: 0.9,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/workspace",
      fileCount: 10,
      relevantFiles: [{ path: "src/app.ts" }],
    },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: "/workspace",
      availableTools: ["read", "execute", "apply_patch"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: [],
    fileRefs: ["src/app.ts"],
    metrics: {},
  };
}

function createMinimalAssessment(): UnifiedAssessment {
  return {
    taskId: newId("task"),
    timestamp: Date.now(),
    situationRef: `task_situation:${newId("task")}:1`,
    phase: "pre-execution",
    complexity: "moderate",
    risk: "low",
    riskAssessment: {
      level: "low",
      factors: [],
    },
    routingDecision: {
      division: "coding",
      workflow: "linear",
      rationale: "simple task",
    },
    resourceAllocation: {
      modelClass: "small",
      maxTokens: 2000,
      timeoutMs: 30000,
    },
    approvalPolicy: {
      required: false,
    },
    executionMode: "auto",
    suggestedActions: [],
  };
}

function createMultiStepWorkflow(steps: number): PlannedWorkflow {
  const stepIds = Array.from({ length: steps }, () => newId("step"));
  const executionSteps = stepIds.map((stepId, i) => ({
    stepId,
    divisionId: "coding",
    roleId: i === 0 ? "planner" : "builder",
    inputKeys: i > 0 ? [`input_${i}`] : [],
    agentId: `agent_${i}`,
    outputKey: `output_${i}`,
    outputSchemaPath: null,
    dependsOnStepIds: i > 0 ? [stepIds[i - 1]!] : [],
    dependencyTypes: {} as Record<string, "hard" | "soft">,
    timeoutMs: 60000,
    maxAttempts: 1,
  }));

  const dependencyEdges = Array.from({ length: Math.max(0, steps - 1) }, (_, i) => ({
    fromStepId: stepIds[i]!,
    toStepId: stepIds[i + 1]!,
  }));

  return {
    workflow: {
      workflowId: "wf_test",
      divisionId: "coding",
      steps: [],
    },
    executionSteps,
    planReason: "test workflow",
    dependencyEdges,
  };
}

test("performance: PlanBuilder.build() with 3-step workflow P99 < 50ms", () => {
  const builder = new PlanBuilder();
  const observation = createMinimalTaskSituation();
  const assessment = createMinimalAssessment();
  const workflow = createMultiStepWorkflow(3);

  const latencies: number[] = [];
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    builder.build({ observation, assessment, workflow });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  assert.ok(
    p99 < 50,
    `PlanBuilder.build() P99 latency ${p99.toFixed(3)}ms exceeds 50ms target`,
  );

  assert.ok(
    p50 < 25,
    `PlanBuilder.build() P50 latency ${p50.toFixed(3)}ms seems unexpectedly high`,
  );
});

test("performance: PlanBuilder.build() with 10-step workflow P99 < 100ms", () => {
  const builder = new PlanBuilder();
  const observation = createMinimalTaskSituation();
  const assessment = createMinimalAssessment();
  const workflow = createMultiStepWorkflow(10);

  const latencies: number[] = [];
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    builder.build({ observation, assessment, workflow });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  assert.ok(
    p99 < 100,
    `PlanBuilder.build() (10-step) P99 latency ${p99.toFixed(3)}ms exceeds 100ms relaxed target`,
  );
});
