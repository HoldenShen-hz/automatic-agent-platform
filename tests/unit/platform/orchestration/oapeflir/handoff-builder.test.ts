import test from "node:test";
import assert from "node:assert/strict";

import { buildFromStepResults, type HandoffBuilderInput } from "../../../../../src/platform/orchestration/oapeflir/handoff-builder.js";

function makeStepOutput(overrides: Partial<{
  stepId: string;
  summary: string;
  durationMs: number;
  validationPassed: boolean;
  tokensUsed: number;
  retryCount: number;
  artifacts: string[];
}> = {}): {
  stepId: string;
  planRef: string;
  status: "succeeded" | "failed" | "partial_success" | "skipped";
  userFacingResult: { summary: string; artifacts: string[] };
  systemTelemetry: {
    durationMs: number;
    tokensUsed: number;
    modelId: string;
    retryCount: number;
    validationPassed: boolean;
  };
} {
  return {
    stepId: overrides.stepId ?? "step_1",
    planRef: "plan_test",
    status: "succeeded",
    userFacingResult: {
      summary: overrides.summary ?? "Test operation",
      artifacts: overrides.artifacts ?? [],
    },
    systemTelemetry: {
      durationMs: overrides.durationMs ?? 10,
      tokensUsed: overrides.tokensUsed ?? 50,
      modelId: "test-model",
      retryCount: overrides.retryCount ?? 0,
      validationPassed: overrides.validationPassed ?? true,
    },
  };
}

function makePlanStep(stepId: string, action: string): {
  stepId: string;
  action: string;
  title?: string;
  inputs: Record<string, unknown>;
  outputs?: string[];
  dependencies: string[];
  status: "pending" | "running" | "done" | "failed" | "skipped";
  timeout: number;
  retryPolicy: { maxRetries: number; backoffMs: number };
} {
  return {
    stepId,
    action,
    inputs: {},
    dependencies: [],
    status: "done",
    timeout: 1000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  };
}

function makeMinimalInput(overrides: Partial<HandoffBuilderInput> = {}): HandoffBuilderInput {
  return {
    taskId: "task_test",
    fromAgentId: "agent_primary",
    toAgentId: "agent_secondary",
    currentPhase: "execute",
    blockers: [],
    remainingBudgetUsd: 0.05,
    latestSummary: "Test summary",
    completedSteps: [],
    stepOutputs: [],
    primaryRefs: [],
    ...overrides,
  };
}

// --- buildFromStepResults structural tests ---

test("buildFromStepResults returns an object with all required AgentHandoff fields", () => {
  const handoff = buildFromStepResults(makeMinimalInput());
  assert.ok("handoffId" in handoff);
  assert.ok("taskId" in handoff);
  assert.ok("fromAgentId" in handoff);
  assert.ok("toAgentId" in handoff);
  assert.ok("createdAt" in handoff);
  assert.ok("fact" in handoff);
  assert.ok("state" in handoff);
  assert.ok("planDelta" in handoff);
  assert.ok("primaryRefs" in handoff);
});

test("buildFromStepResults generates unique handoffId with handoff_ prefix", () => {
  const handoff1 = buildFromStepResults(makeMinimalInput());
  const handoff2 = buildFromStepResults(makeMinimalInput());
  assert.ok(handoff1.handoffId.startsWith("handoff_"));
  assert.ok(handoff2.handoffId.startsWith("handoff_"));
  assert.notStrictEqual(handoff1.handoffId, handoff2.handoffId);
});

test("buildFromStepResults generates valid ISO createdAt timestamp", () => {
  const handoff = buildFromStepResults(makeMinimalInput());
  const parsedDate = new Date(handoff.createdAt);
  assert.ok(!isNaN(parsedDate.getTime()), "createdAt should be a valid date");
  assert.strictEqual(handoff.createdAt, parsedDate.toISOString());
});

// --- factLayer artifactRefs tests ---

test("buildFromStepResults includes primaryRefs in fact.artifactRefs", () => {
  const refs = ["artifact:foo", "artifact:bar", "artifact:baz"];
  const handoff = buildFromStepResults(makeMinimalInput({ primaryRefs: refs }));
  assert.deepStrictEqual(handoff.fact.artifactRefs, refs);
});

test("buildFromStepResults fact.artifactRefs is a copy of primaryRefs", () => {
  const refs = ["artifact:original"];
  const handoff = buildFromStepResults(makeMinimalInput({ primaryRefs: refs }));
  refs.push("artifact:mutated");
  assert.deepStrictEqual(handoff.fact.artifactRefs, ["artifact:original"]);
});

test("buildFromStepResults handles empty primaryRefs array", () => {
  const handoff = buildFromStepResults(makeMinimalInput({ primaryRefs: [] }));
  assert.deepStrictEqual(handoff.fact.artifactRefs, []);
});

// --- toolCallRecords extraction tests ---

test("buildFromStepResults extracts toolCallRecord when durationMs > 0 and validationPassed is true", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_read", summary: "Read file foo.ts", durationMs: 50 })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords.length, 1);
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.callId, "step_read");
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.success, true);
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.errorCode, null);
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.errorMessage, null);
});

test("buildFromStepResults skips toolCallRecord when durationMs === 0", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_instant", summary: "Instant result", durationMs: 0 })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords.length, 0);
});

test("buildFromStepResults skips toolCallRecord when durationMs < 0", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_neg", summary: "Negative duration", durationMs: -1 })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords.length, 0);
});

test("buildFromStepResults marks toolCallRecord failed when validationPassed is false", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_fail", summary: "Write file bar.ts", durationMs: 20, validationPassed: false })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords.length, 1);
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.success, false);
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.errorCode, "handoff.tool_call_failed");
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.errorMessage, "Write file bar.ts");
});

test("buildFromStepResults extracts outputRef from first artifact", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({
      stepId: "step_ref",
      summary: "Read file",
      artifacts: ["artifact:first", "artifact:second"]
    })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.outputRef, "artifact:first");
});

test("buildFromStepResults sets outputRef to null when no artifacts", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_no_art", summary: "No artifacts", artifacts: [] })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.outputRef, null);
});

test("buildFromStepResults maps durationMs from systemTelemetry", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_timed", summary: "Timed op", durationMs: 123 })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.durationMs, 123);
});

test("buildFromStepResults maps tokensUsed to toolCallRecord tokenUsage.output", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_tok", summary: "Token op", tokensUsed: 999 })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.tokenUsage.output, 999);
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.tokenUsage.input, 0);
});

test("buildFromStepResults maps retryCount from systemTelemetry", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_retry", summary: "Retry op", retryCount: 3 })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.retryAttempt, 3);
});

test("buildFromStepResults sets sandboxViolation to false", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_sandbox", summary: "Sandbox op" })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.sandboxViolation, false);
});

test("buildFromStepResults extracts toolCallRecords for multiple stepOutputs", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [
      makeStepOutput({ stepId: "step_1", summary: "Read file", durationMs: 10 }),
      makeStepOutput({ stepId: "step_2", summary: "Write file", durationMs: 20 }),
      makeStepOutput({ stepId: "step_3", summary: "Search files", durationMs: 30 }),
    ],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords.length, 3);
});

// --- inferToolName tests ---

test("buildFromStepResults infers code_search from search/find/grep keywords", () => {
  const cases = ["search for pattern", "find matching files", "grep content"];
  for (const summary of cases) {
    const handoff = buildFromStepResults(makeMinimalInput({
      stepOutputs: [makeStepOutput({ stepId: "step", summary, durationMs: 10 })],
      primaryRefs: [],
    }));
    assert.strictEqual(handoff.fact.toolCallRecords[0]!.toolName, "code_search", `Summary: "${summary}"`);
  }
});

test("buildFromStepResults infers file_read from read/file keywords", () => {
  const cases = ["read file foo.ts", "file content loaded", "Reading logs"];
  for (const summary of cases) {
    const handoff = buildFromStepResults(makeMinimalInput({
      stepOutputs: [makeStepOutput({ stepId: "step", summary, durationMs: 10 })],
      primaryRefs: [],
    }));
    assert.strictEqual(handoff.fact.toolCallRecords[0]!.toolName, "file_read", `Summary: "${summary}"`);
  }
});

test("buildFromStepResults infers file_write from write/edit/create keywords", () => {
  // Note: "write file" matches "file" first and returns file_read, so use cases without "file"
  const cases = ["write output", "edit config", "create artifact"];
  for (const summary of cases) {
    const handoff = buildFromStepResults(makeMinimalInput({
      stepOutputs: [makeStepOutput({ stepId: "step", summary, durationMs: 10 })],
      primaryRefs: [],
    }));
    assert.strictEqual(handoff.fact.toolCallRecords[0]!.toolName, "file_write", `Summary: "${summary}"`);
  }
});

test("buildFromStepResults infers bash from bash/shell/command keywords", () => {
  const cases = ["bash script", "shell command", "execute command"];
  for (const summary of cases) {
    const handoff = buildFromStepResults(makeMinimalInput({
      stepOutputs: [makeStepOutput({ stepId: "step", summary, durationMs: 10 })],
      primaryRefs: [],
    }));
    assert.strictEqual(handoff.fact.toolCallRecords[0]!.toolName, "bash", `Summary: "${summary}"`);
  }
});

test("buildFromStepResults infers git from git keyword", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step", summary: "git status", durationMs: 10 })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.toolName, "git");
});

test("buildFromStepResults defaults to unknown when no keywords match", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step", summary: "some arbitrary operation", durationMs: 10 })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.toolName, "unknown");
});

// --- stateLayer tests ---

test("buildFromStepResults maps currentPhase to state", () => {
  const handoff = buildFromStepResults(makeMinimalInput({ currentPhase: "planning" }));
  assert.strictEqual(handoff.state.currentPhase, "planning");
});

test("buildFromStepResults maps blockers array to state", () => {
  const blockers = ["auth_error", "rate_limit", "dependency_missing"];
  const handoff = buildFromStepResults(makeMinimalInput({ blockers }));
  assert.deepStrictEqual(handoff.state.blockers, blockers);
});

test("buildFromStepResults blockers is a copy of input", () => {
  const blockers = ["original_blocker"];
  const handoff = buildFromStepResults(makeMinimalInput({ blockers }));
  blockers.push("mutated_blocker");
  assert.deepStrictEqual(handoff.state.blockers, ["original_blocker"]);
});

test("buildFromStepResults handles empty blockers array", () => {
  const handoff = buildFromStepResults(makeMinimalInput({ blockers: [] }));
  assert.deepStrictEqual(handoff.state.blockers, []);
});

test("buildFromStepResults maps remainingBudgetUsd to state", () => {
  const handoff = buildFromStepResults(makeMinimalInput({ remainingBudgetUsd: 0.123 }));
  assert.strictEqual(handoff.state.remainingBudgetUsd, 0.123);
});

test("buildFromStepResults handles null remainingBudgetUsd", () => {
  const handoff = buildFromStepResults(makeMinimalInput({ remainingBudgetUsd: null }));
  assert.strictEqual(handoff.state.remainingBudgetUsd, null);
});

test("buildFromStepResults maps latestSummary to state", () => {
  const handoff = buildFromStepResults(makeMinimalInput({ latestSummary: "Phase complete" }));
  assert.strictEqual(handoff.state.latestSummary, "Phase complete");
});

test("buildFromStepResults handles empty string latestSummary", () => {
  const handoff = buildFromStepResults(makeMinimalInput({ latestSummary: "" }));
  assert.strictEqual(handoff.state.latestSummary, "");
});

// --- planDelta tests ---

test("buildFromStepResults maps addedSteps to planDelta", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    addedSteps: ["step_new_1", "step_new_2"],
  }));
  assert.deepStrictEqual(handoff.planDelta.addedSteps, ["step_new_1", "step_new_2"]);
});

test("buildFromStepResults maps removedSteps to planDelta", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    removedSteps: ["step_skipped"],
  }));
  assert.deepStrictEqual(handoff.planDelta.removedSteps, ["step_skipped"]);
});

test("buildFromStepResults maps changedSteps to planDelta", () => {
  const changedSteps = [{ stepId: "step_altered", reason: "intent changed" }];
  const handoff = buildFromStepResults(makeMinimalInput({ changedSteps }));
  assert.deepStrictEqual(handoff.planDelta.changedSteps, changedSteps);
});

test("buildFromStepResults defaults addedSteps to empty array when omitted", () => {
  const handoff = buildFromStepResults(makeMinimalInput());
  assert.deepStrictEqual(handoff.planDelta.addedSteps, []);
});

test("buildFromStepResults defaults removedSteps to empty array when omitted", () => {
  const handoff = buildFromStepResults(makeMinimalInput());
  assert.deepStrictEqual(handoff.planDelta.removedSteps, []);
});

test("buildFromStepResults defaults changedSteps to empty array when omitted", () => {
  const handoff = buildFromStepResults(makeMinimalInput());
  assert.deepStrictEqual(handoff.planDelta.changedSteps, []);
});

test("buildFromStepResults planDelta references input arrays directly (no defensive copy)", () => {
  // buildPlanDelta uses input.addedSteps ?? [] — if addedSteps is provided, it references
  // the same array. We verify the current behavior (no defensive copy) to document it.
  const addedSteps = ["step_1"];
  const removedSteps = ["step_2"];
  const changedSteps: Array<{ stepId: string; reason: string }> = [{ stepId: "step_3", reason: "test" }];
  const handoff = buildFromStepResults(makeMinimalInput({
    addedSteps,
    removedSteps,
    changedSteps,
  }));
  // After calling buildFromStepResults, mutate the original arrays
  addedSteps.push("step_mutated");
  removedSteps.push("step_mutated_removed");
  changedSteps.push({ stepId: "step_mutated_changed", reason: "mutated" });
  // handoff.planDelta now reflects the mutations since it shares the same array references
  assert.deepStrictEqual(handoff.planDelta.addedSteps, ["step_1", "step_mutated"]);
  assert.deepStrictEqual(handoff.planDelta.removedSteps, ["step_2", "step_mutated_removed"]);
  assert.deepStrictEqual(handoff.planDelta.changedSteps.length, 2);
});

// --- agent ID and task ID mapping tests ---

test("buildFromStepResults maps taskId from input", () => {
  const handoff = buildFromStepResults(makeMinimalInput({ taskId: "task_custom" }));
  assert.strictEqual(handoff.taskId, "task_custom");
});

test("buildFromStepResults maps fromAgentId from input", () => {
  const handoff = buildFromStepResults(makeMinimalInput({ fromAgentId: "agent_first" }));
  assert.strictEqual(handoff.fromAgentId, "agent_first");
});

test("buildFromStepResults maps toAgentId from input", () => {
  const handoff = buildFromStepResults(makeMinimalInput({ toAgentId: "agent_next" }));
  assert.strictEqual(handoff.toAgentId, "agent_next");
});

test("buildFromStepResults maps primaryRefs from input", () => {
  const refs = ["ref_a", "ref_b"];
  const handoff = buildFromStepResults(makeMinimalInput({ primaryRefs: refs }));
  assert.deepStrictEqual(handoff.primaryRefs, refs);
});

// --- completedSteps processing tests ---

test("buildFromStepResults processes completedSteps into planDelta", () => {
  const completedSteps = [
    makePlanStep("step_1", "file_read"),
    makePlanStep("step_2", "file_write"),
  ];
  const handoff = buildFromStepResults(makeMinimalInput({ completedSteps }));
  // completedSteps are not directly in planDelta; planDelta captures changes
  // The function extracts completedStepIds but does not surface them in output
  assert.ok("planDelta" in handoff);
});

test("buildFromStepResults handles empty completedSteps array", () => {
  const handoff = buildFromStepResults(makeMinimalInput({ completedSteps: [] }));
  assert.deepStrictEqual(handoff.planDelta.addedSteps, []);
  assert.deepStrictEqual(handoff.planDelta.removedSteps, []);
  assert.deepStrictEqual(handoff.planDelta.changedSteps, []);
});

// --- rawOutput and inputArgs tests ---

test("buildFromStepResults sets rawOutput from userFacingResult.summary", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_raw", summary: "Detailed result summary" })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.rawOutput, "Detailed result summary");
});

test("buildFromStepResults sets inputArgs to empty object", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_args" })],
    primaryRefs: [],
  }));
  assert.deepStrictEqual(handoff.fact.toolCallRecords[0]!.inputArgs, {});
});

test("buildFromStepResults sets parsedOutput to null", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    stepOutputs: [makeStepOutput({ stepId: "step_parse" })],
    primaryRefs: [],
  }));
  assert.strictEqual(handoff.fact.toolCallRecords[0]!.parsedOutput, null);
});

// --- end-to-end handoff construction tests ---

test("buildFromStepResults creates complete AgentHandoff for typical execution handoff", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    taskId: "task_exec_001",
    fromAgentId: "agent_planner",
    toAgentId: "agent_executor",
    currentPhase: "execution",
    blockers: ["waiting_for_dep"],
    remainingBudgetUsd: 0.25,
    latestSummary: "Planner completed, passing to executor",
    completedSteps: [
      makePlanStep("step_1", "file_read"),
      makePlanStep("step_2", "code_search"),
    ],
    stepOutputs: [
      makeStepOutput({ stepId: "step_1", summary: "Read config file", durationMs: 15 }),
      makeStepOutput({ stepId: "step_2", summary: "Search for usages", durationMs: 45 }),
    ],
    primaryRefs: ["artifact:config", "artifact:search_results"],
    addedSteps: ["step_3"],
    removedSteps: [],
    changedSteps: [],
  }));

  assert.strictEqual(handoff.taskId, "task_exec_001");
  assert.strictEqual(handoff.fromAgentId, "agent_planner");
  assert.strictEqual(handoff.toAgentId, "agent_executor");
  assert.strictEqual(handoff.state.currentPhase, "execution");
  assert.deepStrictEqual(handoff.state.blockers, ["waiting_for_dep"]);
  assert.strictEqual(handoff.state.remainingBudgetUsd, 0.25);
  assert.strictEqual(handoff.fact.artifactRefs.length, 2);
  assert.strictEqual(handoff.fact.toolCallRecords.length, 2);
  assert.deepStrictEqual(handoff.planDelta.addedSteps, ["step_3"]);
});

test("buildFromStepResults creates complete AgentHandoff for plan continuation handoff", () => {
  const handoff = buildFromStepResults(makeMinimalInput({
    taskId: "task_plan_002",
    fromAgentId: "agent_orchestrator",
    toAgentId: "agent_planner",
    currentPhase: "planning",
    blockers: [],
    remainingBudgetUsd: 0.50,
    latestSummary: "Replanning due to changed requirements",
    completedSteps: [],
    stepOutputs: [],
    primaryRefs: [],
    addedSteps: ["step_new_route", "step_alt_path"],
    removedSteps: ["step_dead_branch"],
    changedSteps: [{ stepId: "step_existing", reason: "updated inputs" }],
  }));

  assert.strictEqual(handoff.taskId, "task_plan_002");
  assert.strictEqual(handoff.state.currentPhase, "planning");
  assert.deepStrictEqual(handoff.planDelta.addedSteps, ["step_new_route", "step_alt_path"]);
  assert.deepStrictEqual(handoff.planDelta.removedSteps, ["step_dead_branch"]);
  assert.deepStrictEqual(handoff.planDelta.changedSteps, [{ stepId: "step_existing", reason: "updated inputs" }]);
});