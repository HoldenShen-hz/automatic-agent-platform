/**
 * Unit Tests: multi-step-orchestration helper functions - Extended Coverage
 *
 * Tests for untested edge cases in the private helper functions from multi-step-orchestration.ts:
 * - isOapeflirPlanRequest edge cases
 * - deserializeOapeflirPlan edge cases
 * - buildOapeflirPlannedWorkflow edge cases
 * - oapeflirStepToMinimalStep edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

import {
  runMultiStepOrchestration,
  type MultiStepToolExecutionInput,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createTestDbPath(name: string): string {
  return join(__dirname, `test-helpers-${name}.db`);
}

function cleanupDb(dbPath: string): void {
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }
}

// =============================================================================
// isOapeflirPlanRequest edge case tests (via runMultiStepOrchestration)
// =============================================================================

test("isOapeflirPlanRequest returns false for empty string [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("empty-string");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Empty String Test",
    request: "",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result, "Should return result even with empty request");
    assert.ok(!result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"), "Empty request should not be treated as oapeflir plan");
  } finally {
    cleanupDb(dbPath);
  }
});

test("isOapeflirPlanRequest returns false for whitespace only request [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("whitespace");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Whitespace Test",
    request: "   \n\t  ",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.ok(!result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"), "Whitespace request should not be treated as oapeflir plan");
  } finally {
    cleanupDb(dbPath);
  }
});

test("isOapeflirPlanRequest handles oapeflir://plan with only brackets [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("empty-plan");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Empty Plan Test",
    request: "oapeflir://plan []",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.ok(result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"), "Empty plan array should be valid oapeflir request");
  } finally {
    cleanupDb(dbPath);
  }
});

test("isOapeflirPlanRequest returns false for oapeflir://execute (wrong command) [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("wrong-command");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Wrong Command Test",
    request: "oapeflir://execute step_1",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.ok(!result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"), "oapeflir://execute should not be treated as plan request");
  } finally {
    cleanupDb(dbPath);
  }
});

test("isOapeflirPlanRequest case sensitivity - lowercase oapeflir fails [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("case-sensitivity");
  cleanupDb(dbPath);

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Case Sensitivity Test",
    request: "OAPEFLIR://plan [{\"stepId\":\"test\"}]",
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.ok(!result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"), "Uppercase OAPEFLIR should not match");
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// deserializeOapeflirPlan edge case tests
// =============================================================================

test("deserializeOapeflirPlan handles single step plan [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("single-step");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "only_step", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Single Step Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.executionSteps.length, 1);
    assert.equal(result.plannedWorkflow.executionSteps[0]!.stepId, "only_step");
  } finally {
    cleanupDb(dbPath);
  }
});

test("deserializeOapeflirPlan handles step with no dependencies [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("no-deps");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "step_a", dependencies: [], outputs: ["out_a"], timeout: 60000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "No Dependencies Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.deepEqual(result.plannedWorkflow.executionSteps[0]!.dependsOnStepIds, []);
  } finally {
    cleanupDb(dbPath);
  }
});

test("deserializeOapeflirPlan handles step with multiple dependencies [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("multi-deps");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "step_final", dependencies: ["dep_a", "dep_b", "dep_c"], outputs: ["final_out"], timeout: 120000, retryPolicy: { maxRetries: 2 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Multiple Dependencies Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.executionSteps[0]!.dependsOnStepIds.length, 3);
    assert.deepEqual(result.plannedWorkflow.executionSteps[0]!.dependsOnStepIds, ["dep_a", "dep_b", "dep_c"]);
  } finally {
    cleanupDb(dbPath);
  }
});

test("deserializeOapeflirPlan handles plan with many steps [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("many-steps");
  cleanupDb(dbPath);

  const planSteps = Array.from({ length: 20 }, (_, i) => ({
    stepId: `step_${i}`,
    dependencies: i > 0 ? [`step_${i - 1}`] : [],
    timeout: 30000,
    retryPolicy: { maxRetries: 0 },
  }));

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Many Steps Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.executionSteps.length, 20);
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// oapeflirStepToMinimalStep edge case tests
// =============================================================================

test("oapeflirStepToMinimalStep handles step with undefined outputs [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("undefined-outputs");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "no_output_step", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Undefined Outputs Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    const step = result.plannedWorkflow.executionSteps[0]!;
    assert.ok(step.outputKey.startsWith("output_"), "Should generate default output key");
  } finally {
    cleanupDb(dbPath);
  }
});

test("oapeflirStepToMinimalStep handles step with empty outputs array [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("empty-outputs");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "empty_output_step", dependencies: [], outputs: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Empty Outputs Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    const step = result.plannedWorkflow.executionSteps[0]!;
    assert.ok(step.outputKey.startsWith("output_"), "Empty outputs should use default output key");
  } finally {
    cleanupDb(dbPath);
  }
});

test("oapeflirStepToMinimalStep handles maxAttempts calculation with zero retries [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("zero-retries");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "zero_retry_step", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Zero Retries Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.executionSteps[0]!.maxAttempts, 1, "maxAttempts should be 1 when maxRetries is 0");
  } finally {
    cleanupDb(dbPath);
  }
});

test("oapeflirStepToMinimalStep handles maxAttempts calculation with high retry count [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("high-retries");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "high_retry_step", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 10 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "High Retry Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.executionSteps[0]!.maxAttempts, 11, "maxAttempts should be maxRetries + 1");
  } finally {
    cleanupDb(dbPath);
  }
});

test("oapeflirStepToMinimalStep maps timeout correctly [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("timeout-mapping");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "timeout_step", dependencies: [], timeout: 120000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Timeout Mapping Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.executionSteps[0]!.timeoutMs, 120000, "timeoutMs should match step timeout");
  } finally {
    cleanupDb(dbPath);
  }
});

// =============================================================================
// buildOapeflirPlannedWorkflow edge case tests
// =============================================================================

test("buildOapeflirPlannedWorkflow generates correct agentId [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("agent-id");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "agent_step", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Agent ID Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.executionSteps[0]!.agentId, "agent_general_executor");
  } finally {
    cleanupDb(dbPath);
  }
});

test("buildOapeflirPlannedWorkflow sets divisionId correctly [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("division-id");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "division_step", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Division ID Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.workflow.divisionId, "general-ops");
  } finally {
    cleanupDb(dbPath);
  }
});

test("buildOapeflirPlannedWorkflow creates correct planReason [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("plan-reason");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "reason_step", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "my-custom-plan-id",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.ok(result.plannedWorkflow.planReason.includes("oapeflir_bridge"));
    assert.ok(result.plannedWorkflow.planReason.includes("my-custom-plan-id"));
  } finally {
    cleanupDb(dbPath);
  }
});

test("buildOapeflirPlannedWorkflow sets a default outputSchemaPath [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("output-schema-path");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "schema_step", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Output Schema Path Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.ok(result.plannedWorkflow.executionSteps[0]!.outputSchemaPath?.endsWith("/divisions/general-ops/schemas/minimal-output.json"));
  } finally {
    cleanupDb(dbPath);
  }
});

test("buildOapeflirPlannedWorkflow creates empty dependencyEdges [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("dependency-edges");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "edge_step", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Dependency Edges Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.ok(Array.isArray(result.plannedWorkflow.dependencyEdges));
  } finally {
    cleanupDb(dbPath);
  }
});

test("buildOapeflirPlannedWorkflow with inputKeys mapping [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("input-keys");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "input_step", dependencies: ["dep1", "dep2"], inputKeys: ["dep1", "dep2"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Input Keys Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.deepEqual(result.plannedWorkflow.executionSteps[0]!.inputKeys, ["dep1", "dep2"]);
  } finally {
    cleanupDb(dbPath);
  }
});

test("buildOapeflirPlannedWorkflow with dependencyTypes set to hard [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("dependency-types");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "types_step", dependencies: ["dep1"], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Dependency Types Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.executionSteps[0]!.dependencyTypes["dep1"], "hard");
  } finally {
    cleanupDb(dbPath);
  }
});

test("buildOapeflirPlannedWorkflow handles plan with unicode step IDs [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("unicode-steps");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "步骤_1", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Unicode Steps Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.executionSteps[0]!.stepId, "步骤_1");
  } finally {
    cleanupDb(dbPath);
  }
});

test("buildOapeflirPlannedWorkflow handles plan with special characters in stepId [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("special-chars");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "step-with-dashes_and_underscores.123", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Special Chars Test",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.equal(result.plannedWorkflow.executionSteps[0]!.stepId, "step-with-dashes_and_underscores.123");
  } finally {
    cleanupDb(dbPath);
  }
});

test("buildOapeflirPlannedWorkflow workflowId format [multi-step-orchestration-helpers-coverage]", async () => {
  const dbPath = createTestDbPath("workflow-id-format");
  cleanupDb(dbPath);

  const planSteps = [
    { stepId: "format_step", dependencies: [], timeout: 30000, retryPolicy: { maxRetries: 0 } },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "plan-123-abc",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result);
    assert.ok(result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"));
    assert.ok(result.plannedWorkflow.workflow.workflowId.includes("plan-123-abc"));
  } finally {
    cleanupDb(dbPath);
  }
});
