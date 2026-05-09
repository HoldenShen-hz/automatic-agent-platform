import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  normalizeConstraintPack,
  type ConstraintPack,
} from "../../../src/platform/orchestration/harness/index.js";
import {
  PHASE_1_LEARNING_TYPES,
  normalizeLearningType,
} from "../../../src/platform/orchestration/learn/learning-object-model.js";
import {
  AgentDefinitionSchema,
} from "../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";
import {
  HANDOFF_LEVEL_TOKEN_BUDGET,
  createAgentHandoff,
} from "../../../src/platform/orchestration/oapeflir/handoff-model.js";
import { serializeHandoff } from "../../../src/platform/orchestration/oapeflir/handoff-serializer.js";

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 60_000 },
    approvalRequirement: {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["admin"],
      escalationTimeoutMs: 60_000,
    },
    ...overrides,
  };
}

test("R25-26 constraint packs normalize legacy autonomy modes into unified runtime modes", () => {
  const normalized = normalizeConstraintPack(createConstraintPack({ autonomyMode: "semi_auto" }));
  const documented = normalizeConstraintPack(createConstraintPack({ autonomyMode: "no-write" }));

  assert.equal(normalized.autonomyMode, "supervised_auto");
  assert.equal(documented.autonomyMode, "no_write");
});

test("R25-27 learning object model freezes phase-1 learning types and normalizes deprecated extras", () => {
  assert.deepEqual(PHASE_1_LEARNING_TYPES, [
    "failure_pattern",
    "user_correction",
    "recovery_playbook",
  ]);
  assert.equal(normalizeLearningType("model_retraining"), "user_correction");
  assert.equal(normalizeLearningType("dataset_gap"), "failure_pattern");
});

test("R25-28 handoff serializer now projects L1 context summary semantics instead of leading with facts", () => {
  const handoff = createAgentHandoff({
    taskId: "task-1",
    fromAgentId: "agent-a",
    toAgentId: "agent-b",
    contextSummary: "Summarized context",
    fact: {
      artifactRefs: ["artifact:1", "artifact:2"],
      toolCallRecords: [],
    },
    state: {
      currentPhase: "execute",
      blockers: ["b1", "b2"],
      remainingBudgetUsd: 1.5,
      latestSummary: "Detailed runtime summary",
    },
    planDelta: {
      addedSteps: ["s1"],
      removedSteps: ["s0"],
      changedSteps: [{ stepId: "s2", reason: "retry" }],
    },
    primaryRefs: ["artifact:1", "artifact:2"],
    historyRefs: ["history:1", "history:2"],
  });

  const projected = serializeHandoff(handoff, { level: "L1_context_summary" });

  assert.equal(projected.state.latestSummary, "Summarized context");
  assert.deepEqual(projected.fact.artifactRefs, []);
  assert.deepEqual(projected.planDelta.addedSteps, []);
  assert.deepEqual(projected.historyRefs, []);
});

test("R25-30 ADR-003 seven-layer aliases are now explicit redirect stubs to the six-layer ADR", () => {
  const zhStub = readRepoFile("docs_zh/adr/003-memory-seven-layers.md");
  const enStub = readRepoFile("docs_en/adr/003-memory-seven-layers.md");

  assert.match(zhStub, /003-memory-six-layers\.md/);
  assert.match(enStub, /003-memory-six-layers\.md/);
  assert.match(enStub, /compatibility redirect/i);
});

test("R25-31 stable evidence bundle now includes dispatch, worker-handshake, and worker-writeback rehearsals", () => {
  const source = readRepoFile("src/platform/stability/stable-evidence-bundle.ts");
  const supportSource = readRepoFile("src/platform/stability/stable-evidence-bundle-support.ts");

  assert.match(source, /dispatchReportPath/);
  assert.match(source, /workerHandshakeReportPath/);
  assert.match(source, /workerWritebackReportPath/);
  assert.match(source, /runStableDispatchRehearsal/);
  assert.match(source, /runStableWorkerHandshakeRehearsal/);
  assert.match(source, /runStableWorkerWritebackRehearsal/);
  assert.match(supportSource, /dispatchPassed: boolean/);
  assert.match(supportSource, /workerHandshakePassed: boolean/);
  assert.match(supportSource, /workerWritebackPassed: boolean/);
});

test("R25-32 agent registry normalizes legacy autonomy fields into unified runtime modes", () => {
  const parsed = AgentDefinitionSchema.parse({
    agentId: "agent-1",
    name: "Test Agent",
    domainId: "domain-1",
    owner: { orgNodeId: "node-1", path: "/org/team" },
    components: {
      pack: { packId: "pack-1", version: "1.0.0" },
      promptBundle: { bundleId: "bundle-1", version: "1.0.0" },
      modelBinding: { provider: "openai", model: "gpt-5.4", fallbackChain: [] },
      trustProfile: { initialLevel: "suggestion" },
      triggerSet: [],
      connectorBindings: [],
      autonomyConfig: { maxAutomationLevel: "supervised" },
    },
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
  });

  assert.equal(parsed.components.trustProfile.initialLevel, "no_write");
  assert.equal(parsed.components.autonomyConfig.maxAutomationLevel, "manual_only");
});

test("R25-33 handoff model exports explicit four-level budgets and L4 retains history refs", () => {
  assert.deepEqual(HANDOFF_LEVEL_TOKEN_BUDGET, {
    L1_context_summary: 200,
    L2_state_delta: 500,
    L3_facts_plan_delta: 2_000,
    L4_full: 8_000,
  });

  const handoff = createAgentHandoff({
    taskId: "task-2",
    fromAgentId: "agent-a",
    toAgentId: "agent-b",
    fact: { artifactRefs: [], toolCallRecords: [] },
    state: {
      currentPhase: "plan",
      blockers: [],
      remainingBudgetUsd: null,
      latestSummary: "Full handoff",
    },
    planDelta: { addedSteps: [], removedSteps: [], changedSteps: [] },
    primaryRefs: [],
    historyRefs: ["history:full"],
  });

  const full = serializeHandoff(handoff, { level: "L4_full" });
  assert.deepEqual(full.historyRefs, ["history:full"]);
});

test("R25-45 UI workspace is pinned to npm workspaces and has no pnpm/turbo repo roots", () => {
  const uiPackage = JSON.parse(readRepoFile("ui/package.json")) as { workspaces?: string[] };

  assert.ok(Array.isArray(uiPackage.workspaces));
  assert.equal(existsSync(resolve(process.cwd(), "pnpm-workspace.yaml")), false);
  assert.equal(existsSync(resolve(process.cwd(), "turbo.json")), false);
});
