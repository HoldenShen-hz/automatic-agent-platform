import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { SimpleProposalEngine, type ProposalKind, type ImprovementProposal } from "../../../../../src/ops-maturity/drift-detection/proposal-engine.js";
import type { ReflectionRecord } from "../../../../../src/ops-maturity/drift-detection/reflection-engine.js";

const mockReflection = (overrides: Partial<ReflectionRecord> = {}): ReflectionRecord => ({
  id: "ref-1",
  evidenceIds: ["evidence-1"],
  taskType: "test_task",
  rootCause: "type_error",
  recommendation: "Add explicit type annotations",
  confidence: 0.8,
  createdAt: new Date().toISOString(),
  ...overrides,
});

test("SimpleProposalEngine creates proposal with correct structure", async () => {
  const engine = new SimpleProposalEngine();

  const proposal = await engine.create({
    title: "Test Proposal",
    description: "Test description",
    kind: "tool_routing_rule",
    target: "test_target",
    risk: "low",
    agentId: "agent-1",
    evidenceIds: ["evidence-1"],
  });

  assert.strictEqual(proposal.title, "Test Proposal");
  assert.strictEqual(proposal.description, "Test description");
  assert.strictEqual(proposal.kind, "tool_routing_rule");
  assert.strictEqual(proposal.target, "test_target");
  assert.strictEqual(proposal.risk, "low");
  assert.strictEqual(proposal.status, "proposed");
  assert.ok(proposal.id.startsWith("prop_"));
});

test("SimpleProposalEngine.proposeFromReflection generates tool routing proposal for type errors", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = mockReflection({ rootCause: "type_error" });

  const proposals = await engine.proposeFromReflection(reflection);

  assert.ok(proposals.length > 0);
  const toolProposal = proposals.find((p: ImprovementProposal) => p.kind === "tool_routing_rule");
  assert.ok(toolProposal !== undefined);
  assert.strictEqual(toolProposal?.target, "type_validation");
});

test("SimpleProposalEngine.proposeFromReflection generates skill doc proposal for test failures", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = mockReflection({ rootCause: "test_failure" });

  const proposals = await engine.proposeFromReflection(reflection);

  const skillProposal = proposals.find((p: ImprovementProposal) => p.kind === "skill_doc");
  assert.ok(skillProposal !== undefined);
  assert.strictEqual(skillProposal?.target, "testing_guidelines");
});

test("SimpleProposalEngine.proposeFromReflection generates workflow template for complex planning", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = mockReflection({ rootCause: "complex_planning" });

  const proposals = await engine.proposeFromReflection(reflection);

  const workflowProposal = proposals.find((p: ImprovementProposal) => p.kind === "workflow_template");
  assert.ok(workflowProposal !== undefined);
  assert.strictEqual(workflowProposal?.target, "complex_task_template");
  assert.strictEqual(workflowProposal?.risk, "medium");
});

test("SimpleProposalEngine.proposeFromReflection generates prompt patch for security issues", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = mockReflection({ rootCause: "security_vulnerability" });

  const proposals = await engine.proposeFromReflection(reflection);

  const promptProposal = proposals.find((p: ImprovementProposal) => p.kind === "prompt_patch");
  assert.ok(promptProposal !== undefined);
  assert.strictEqual(promptProposal?.risk, "high");
});

test("SimpleProposalEngine.propose handles multiple reflections", async () => {
  const engine = new SimpleProposalEngine();
  const reflections = [
    mockReflection({ id: "ref-1", rootCause: "type_error" }),
    mockReflection({ id: "ref-2", rootCause: "test_failure" }),
  ];

  const proposals = await engine.propose(reflections);

  assert.ok(proposals.length >= 2);
});

test("SimpleProposalEngine.canAutoPromote returns true for auto-promote kinds", () => {
  const engine = new SimpleProposalEngine();

  assert.strictEqual(engine.canAutoPromote("tool_routing_rule"), true);
  assert.strictEqual(engine.canAutoPromote("skill_doc"), true);
});

test("SimpleProposalEngine.canAutoPromote returns false for manual-only kinds", () => {
  const engine = new SimpleProposalEngine();

  assert.strictEqual(engine.canAutoPromote("prompt_patch"), false);
  assert.strictEqual(engine.canAutoPromote("workflow_template"), false);
  assert.strictEqual(engine.canAutoPromote("threshold_tuning"), false);
});

test("SimpleProposalEngine.requiresManualApproval returns true for manual-only kinds", () => {
  const engine = new SimpleProposalEngine();

  assert.strictEqual(engine.requiresManualApproval("prompt_patch"), true);
  assert.strictEqual(engine.requiresManualApproval("workflow_template"), true);
  assert.strictEqual(engine.requiresManualApproval("threshold_tuning"), true);
});

test("SimpleProposalEngine.submitForApproval updates proposal status to testing", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    risk: "low",
    agentId: "agent-1",
    evidenceIds: [],
  });

  await engine.submitForApproval(proposal.id);

  const active = await engine.listActive();
  assert.ok(active.some((p: ImprovementProposal) => p.id === proposal.id));
});

test("SimpleProposalEngine.listPending returns only proposed proposals", async () => {
  const engine = new SimpleProposalEngine();

  await engine.create({
    title: "Test1",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    risk: "low",
    agentId: "agent-1",
    evidenceIds: [],
  });

  const pending = await engine.listPending();

  assert.ok(pending.every((p: ImprovementProposal) => p.status === "proposed"));
});

test("SimpleProposalEngine.listActive returns proposals in testing, canary, or active status", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    risk: "low",
    agentId: "agent-1",
    evidenceIds: [],
  });

  await engine.submitForApproval(proposal.id);

  const active = await engine.listActive();

  assert.ok(active.some((p: ImprovementProposal) => p.status === "testing"));
});

test("SimpleProposalEngine.proposeFromReflection returns multiple proposals for complex reflection", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = mockReflection({ rootCause: "type_error and test_failure" });

  const proposals = await engine.proposeFromReflection(reflection);

  assert.ok(proposals.length >= 1);
});

test("SimpleProposalEngine.proposeFromReflection handles root cause case insensitively", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = mockReflection({ rootCause: "TYPE_ERROR" });

  const proposals = await engine.proposeFromReflection(reflection);

  assert.ok(proposals.length > 0);
});

test("SimpleProposalEngine assigns expectedBenefit to proposals", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = mockReflection({ rootCause: "type_error" });

  const proposals = await engine.proposeFromReflection(reflection);

  const proposal = proposals.find((p: ImprovementProposal) => p.kind === "tool_routing_rule");
  assert.ok(proposal?.expectedBenefit !== undefined);
  assert.ok(typeof proposal?.expectedBenefit?.stability === "number");
});

test("SimpleProposalEngine assigns evidenceIds to proposals from reflection", async () => {
  const engine = new SimpleProposalEngine();
  const reflection = mockReflection({ evidenceIds: ["e1", "e2", "e3"] });

  const proposals = await engine.proposeFromReflection(reflection);

  for (const proposal of proposals) {
    assert.ok(proposal.evidenceIds.length >= 1);
  }
});

test("SimpleProposalEngine creates proposals with unique IDs", async () => {
  const engine = new SimpleProposalEngine();

  const p1 = await engine.create({
    title: "Test1",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    risk: "low",
    agentId: "agent-1",
    evidenceIds: [],
  });

  const p2 = await engine.create({
    title: "Test2",
    description: "Test",
    kind: "skill_doc",
    target: "test",
    risk: "low",
    agentId: "agent-1",
    evidenceIds: [],
  });

  assert.notStrictEqual(p1.id, p2.id);
});

test("SimpleProposalEngine sets createdAt and updatedAt timestamps", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    risk: "low",
    agentId: "agent-1",
    evidenceIds: [],
  });

  assert.ok(proposal.createdAt.length > 0);
  assert.ok(proposal.updatedAt.length > 0);
  assert.strictEqual(proposal.createdAt, proposal.updatedAt);
});

test("SimpleProposalEngine submits to approval updates updatedAt", async () => {
  const engine = new SimpleProposalEngine();
  const proposal = await engine.create({
    title: "Test",
    description: "Test",
    kind: "tool_routing_rule",
    target: "test",
    risk: "low",
    agentId: "agent-1",
    evidenceIds: [],
  });

  const originalUpdatedAt = proposal.updatedAt;

  await engine.submitForApproval(proposal.id);

  const updated = (await engine.listActive()).find((p: ImprovementProposal) => p.id === proposal.id);
  assert.ok(updated);
  assert.notStrictEqual(updated?.updatedAt, originalUpdatedAt);
});