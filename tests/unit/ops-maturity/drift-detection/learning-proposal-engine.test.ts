/**
 * Tests for learning/proposal-engine.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  SimpleProposalEngine,
  type ImprovementProposal,
  type ProposalKind,
} from "../../../../src/ops-maturity/drift-detection/proposal-engine.js";
import type { ReflectionRecord } from "../../../../src/ops-maturity/drift-detection/reflection-engine.js";

function createTestReflection(overrides: Partial<ReflectionRecord> = {}): ReflectionRecord {
  const now = new Date().toISOString();
  return {
    id: "refl_test_1",
    evidenceIds: ["ev_1", "ev_2"],
    taskType: "general_task",
    rootCause: "type validation error",
    recommendation: "Add explicit type annotations",
    confidence: 0.75,
    createdAt: now,
    patternType: "failure",
    ...overrides,
  };
}

test("SimpleProposalEngine propose generates proposals from reflections", async () => {
  const engine = new SimpleProposalEngine();
  const reflections = [
    createTestReflection({ rootCause: "type error in schema validation" }),
  ];
  const proposals = await engine.propose(reflections);
  assert.ok(proposals.length > 0);
});

test("SimpleProposalEngine propose returns empty array for empty reflections", async () => {
  const engine = new SimpleProposalEngine();
  const proposals = await engine.propose([]);
  assert.strictEqual(proposals.length, 0);
});

test("SimpleProposalEngine proposeFromReflection creates tool_routing_rule proposal for type errors", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = createTestReflection({ rootCause: "type validation error" });
  const proposals = await engine.proposeFromReflection(reflection);

  const toolRoutingProposals = proposals.filter((p) => p.kind === "tool_routing_rule");
  assert.ok(toolRoutingProposals.length > 0);
});

test("SimpleProposalEngine proposeFromReflection creates skill_doc proposal for test failures", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = createTestReflection({ rootCause: "test failure in edge cases" });
  const proposals = await engine.proposeFromReflection(reflection);

  const skillDocProposals = proposals.filter((p) => p.kind === "skill_doc");
  assert.ok(skillDocProposals.length > 0);
});

test("SimpleProposalEngine proposeFromReflection creates workflow_template proposal for complex planning failures", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = createTestReflection({ rootCause: "complex planning failure" });
  const proposals = await engine.proposeFromReflection(reflection);

  const workflowProposals = proposals.filter((p) => p.kind === "workflow_template");
  assert.ok(workflowProposals.length > 0);
});

test("SimpleProposalEngine proposeFromReflection creates high-risk prompt_patch proposal for security issues", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = createTestReflection({ rootCause: "security vulnerability detected" });
  const proposals = await engine.proposeFromReflection(reflection);

  const securityProposals = proposals.filter((p) => p.kind === "prompt_patch");
  assert.ok(securityProposals.length > 0);
  const highRiskProposals = securityProposals.filter((p) => p.risk === "high");
  assert.ok(highRiskProposals.length > 0);
});

test("SimpleProposalEngine proposeFromReflection sets appropriate risk based on kind and target", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = createTestReflection({ rootCause: "type validation error" });
  const proposals = await engine.proposeFromReflection(reflection);

  for (const proposal of proposals) {
    assert.ok(["low", "medium", "high"].includes(proposal.risk));
  }
});

test("SimpleProposalEngine proposeFromReflection sets manual_review requirement for high and medium risk", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = createTestReflection({ rootCause: "security vulnerability" });
  const proposals = await engine.proposeFromReflection(reflection);

  const highRiskProposal = proposals.find((p) => p.risk === "high");
  if (highRiskProposal) {
    assert.strictEqual(highRiskProposal.reviewRequirement, "manual_review");
  }
});

test("SimpleProposalEngine create creates a new proposal with correct fields", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "Test Proposal",
    description: "Test description",
    kind: "tool_routing_rule",
    target: "test_target",
    risk: "low",
    agentId: "agent_1",
    evidenceIds: ["ev_1"],
  });

  assert.strictEqual(proposal.title, "Test Proposal");
  assert.strictEqual(proposal.kind, "tool_routing_rule");
  assert.strictEqual(proposal.risk, "low");
  assert.strictEqual(proposal.status, "draft");
  assert.ok(proposal.id.startsWith("prop_"));
});

test("SimpleProposalEngine create sets auto review requirement for low risk", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "Low Risk Proposal",
    description: "Low risk description",
    kind: "skill_doc",
    target: "test",
    risk: "low",
    agentId: "agent_1",
    evidenceIds: [],
  });

  assert.strictEqual(proposal.reviewRequirement, "auto");
});

test("SimpleProposalEngine create sets manual_review requirement for high risk", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "High Risk Proposal",
    description: "High risk description",
    kind: "prompt_patch",
    target: "test",
    risk: "high",
    agentId: "agent_1",
    evidenceIds: [],
  });

  assert.strictEqual(proposal.reviewRequirement, "manual_review");
});

test("SimpleProposalEngine submitForApproval updates proposal status to reviewed", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "Test Proposal",
    description: "Test description",
    kind: "tool_routing_rule",
    target: "test_target",
    risk: "low",
    agentId: "agent_1",
    evidenceIds: [],
  });

  await engine.submitForApproval(proposal.id);
  const pending = await engine.listPending();
  const active = await engine.listActive();

  assert.strictEqual(pending.length, 0);
  assert.ok(active.some((p) => p.id === proposal.id));
});

test("SimpleProposalEngine listPending returns proposals with draft status", async () => {
  const engine = new SimpleProposalEngine();
  await engine.create({
    title: "Proposal 1",
    description: "Description 1",
    kind: "tool_routing_rule",
    target: "target_1",
    risk: "low",
    agentId: "agent_1",
    evidenceIds: [],
  });

  const pending = await engine.listPending();
  assert.ok(pending.length > 0);
  pending.forEach((p) => {
    assert.strictEqual(p.status, "draft");
  });
});

test("SimpleProposalEngine listActive returns proposals with reviewed, staged, or stable status", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "Proposal 1",
    description: "Description 1",
    kind: "tool_routing_rule",
    target: "target_1",
    risk: "low",
    agentId: "agent_1",
    evidenceIds: [],
  });

  await engine.submitForApproval(proposal.id);
  const active = await engine.listActive();
  assert.ok(active.some((p) => p.id === proposal.id));
});

test("SimpleProposalEngine canAutoPromote returns true for tool_routing_rule", () => {
  const engine = new SimpleProposalEngine();
  assert.strictEqual(engine.canAutoPromote("tool_routing_rule"), true);
});

test("SimpleProposalEngine canAutoPromote returns true for skill_doc", () => {
  const engine = new SimpleProposalEngine();
  assert.strictEqual(engine.canAutoPromote("skill_doc"), true);
});

test("SimpleProposalEngine canAutoPromote returns false for prompt_patch", () => {
  const engine = new SimpleProposalEngine();
  assert.strictEqual(engine.canAutoPromote("prompt_patch"), false);
});

test("SimpleProposalEngine canAutoPromote returns false for workflow_template", () => {
  const engine = new SimpleProposalEngine();
  assert.strictEqual(engine.canAutoPromote("workflow_template"), false);
});

test("SimpleProposalEngine canAutoPromote returns false for threshold_tuning", () => {
  const engine = new SimpleProposalEngine();
  assert.strictEqual(engine.canAutoPromote("threshold_tuning"), false);
});

test("SimpleProposalEngine requiresManualApproval returns true for prompt_patch", () => {
  const engine = new SimpleProposalEngine();
  assert.strictEqual(engine.requiresManualApproval("prompt_patch"), true);
});

test("SimpleProposalEngine requiresManualApproval returns true for workflow_template", () => {
  const engine = new SimpleProposalEngine();
  assert.strictEqual(engine.requiresManualApproval("workflow_template"), true);
});

test("SimpleProposalEngine requiresManualApproval returns true for threshold_tuning", () => {
  const engine = new SimpleProposalEngine();
  assert.strictEqual(engine.requiresManualApproval("threshold_tuning"), true);
});

test("SimpleProposalEngine requiresManualApproval returns false for tool_routing_rule", () => {
  const engine = new SimpleProposalEngine();
  assert.strictEqual(engine.requiresManualApproval("tool_routing_rule"), false);
});

test("SimpleProposalEngine requiresManualApproval returns false for skill_doc", () => {
  const engine = new SimpleProposalEngine();
  assert.strictEqual(engine.requiresManualApproval("skill_doc"), false);
});