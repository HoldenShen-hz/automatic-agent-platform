import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainInteractionPolicyService,
  isCrossDomainInteractionAllowed,
  type DomainInteractionRequest,
  type DomainInteractionRule,
  DomainInteractionModeSchema,
} from "../../../../src/domains/interaction-policy/index.js";

const sampleRule: DomainInteractionRule = {
  sourceDomainId: "coding",
  targetDomainId: "security",
  mode: "allow",
  maxConcurrentWorkflows: 3,
  compensationRequired: true,
};

const sampleRequest: DomainInteractionRequest = {
  sourceDomainId: "coding",
  targetDomainId: "security",
  actorId: "user_1",
  workflowId: "wf_1",
  concurrentWorkflowCount: 1,
};

// --- DomainInteractionModeSchema ---

test("DomainInteractionModeSchema accepts valid modes", () => {
  assert.equal(DomainInteractionModeSchema.parse("allow"), "allow");
  assert.equal(DomainInteractionModeSchema.parse("approval_required"), "approval_required");
  assert.equal(DomainInteractionModeSchema.parse("deny"), "deny");
});

test("DomainInteractionModeSchema rejects invalid modes", () => {
  assert.throws(() => DomainInteractionModeSchema.parse("invalid"), /invalid_enum_value/);
});

test("DomainInteractionModeSchema rejects non-string values", () => {
  assert.throws(() => DomainInteractionModeSchema.parse(123), /invalid_type/);
  assert.throws(() => DomainInteractionModeSchema.parse(null), /invalid_type/);
  assert.throws(() => DomainInteractionModeSchema.parse(undefined), /invalid_type/);
});

// --- isCrossDomainInteractionAllowed ---

test("isCrossDomainInteractionAllowed returns true when rule mode is allow", () => {
  const result = isCrossDomainInteractionAllowed([sampleRule], "coding", "security");
  assert.equal(result, true);
});

test("isCrossDomainInteractionAllowed returns false when rule mode is approval_required", () => {
  const rule: DomainInteractionRule = { ...sampleRule, mode: "approval_required" };
  const result = isCrossDomainInteractionAllowed([rule], "coding", "security");
  assert.equal(result, false);
});

test("isCrossDomainInteractionAllowed returns false when rule mode is deny", () => {
  const rule: DomainInteractionRule = { ...sampleRule, mode: "deny" };
  const result = isCrossDomainInteractionAllowed([rule], "coding", "security");
  assert.equal(result, false);
});

test("isCrossDomainInteractionAllowed returns false when no matching rule exists", () => {
  const result = isCrossDomainInteractionAllowed([sampleRule], "unknown", "security");
  assert.equal(result, false);
});

test("isCrossDomainInteractionAllowed returns false for empty rules array", () => {
  const result = isCrossDomainInteractionAllowed([], "coding", "security");
  assert.equal(result, false);
});

test("isCrossDomainInteractionAllowed returns false when rule does not match target domain", () => {
  const result = isCrossDomainInteractionAllowed([sampleRule], "coding", "unknown");
  assert.equal(result, false);
});

// --- DomainInteractionPolicyService.evaluate ---

test("evaluate returns denied when no rule matches", () => {
  const service = new DomainInteractionPolicyService();
  const decision = service.evaluate([], sampleRequest);
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresApproval, false);
  assert.equal(decision.compensationRequired, false);
  assert.deepEqual(decision.reasonCodes, ["domain_interaction.rule_not_found"]);
  assert.equal(decision.applicableRule, null);
});

test("evaluate returns denied when concurrent count exceeds max", () => {
  const service = new DomainInteractionPolicyService();
  const request: DomainInteractionRequest = { ...sampleRequest, concurrentWorkflowCount: 10 };
  const decision = service.evaluate([sampleRule], request);
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresApproval, false);
  assert.equal(decision.compensationRequired, true);
  assert.deepEqual(decision.reasonCodes, ["domain_interaction.concurrent_limit_exceeded"]);
  assert.equal(decision.applicableRule, sampleRule);
});

test("evaluate returns denied when rule mode is deny", () => {
  const service = new DomainInteractionPolicyService();
  const rule: DomainInteractionRule = { ...sampleRule, mode: "deny", compensationRequired: false };
  const decision = service.evaluate([rule], sampleRequest);
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresApproval, false);
  assert.equal(decision.compensationRequired, false);
  assert.deepEqual(decision.reasonCodes, ["domain_interaction.denied"]);
  assert.equal(decision.applicableRule, rule);
});

test("evaluate returns approval_required when rule mode is approval_required", () => {
  const service = new DomainInteractionPolicyService();
  const rule: DomainInteractionRule = { ...sampleRule, mode: "approval_required" };
  const decision = service.evaluate([rule], sampleRequest);
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresApproval, true);
  assert.equal(decision.compensationRequired, true);
  assert.deepEqual(decision.reasonCodes, ["domain_interaction.approval_required"]);
  assert.equal(decision.applicableRule, rule);
});

test("evaluate returns allowed when rule mode is allow and within concurrent limit", () => {
  const service = new DomainInteractionPolicyService();
  const decision = service.evaluate([sampleRule], sampleRequest);
  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresApproval, false);
  assert.equal(decision.compensationRequired, true);
  assert.deepEqual(decision.reasonCodes, [
    "domain_interaction.allowed",
    "domain_interaction.compensation_required",
  ]);
  assert.equal(decision.applicableRule, sampleRule);
});

test("evaluate returns allowed without compensation_required in reasonCodes when compensationRequired is false", () => {
  const service = new DomainInteractionPolicyService();
  const rule: DomainInteractionRule = { ...sampleRule, compensationRequired: false };
  const decision = service.evaluate([rule], sampleRequest);
  assert.equal(decision.allowed, true);
  assert.equal(decision.compensationRequired, false);
  assert.deepEqual(decision.reasonCodes, ["domain_interaction.allowed"]);
});

test("evaluate returns concurrent_limit_exceeded when count exceeded even with approval_required mode", () => {
  const service = new DomainInteractionPolicyService();
  const rule: DomainInteractionRule = { ...sampleRule, mode: "approval_required" };
  const request: DomainInteractionRequest = { ...sampleRequest, concurrentWorkflowCount: 10 };
  const decision = service.evaluate([rule], request);
  // concurrent limit check takes precedence over approval_required mode
  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresApproval, false);
  assert.deepEqual(decision.reasonCodes, ["domain_interaction.concurrent_limit_exceeded"]);
});

test("evaluate picks the correct rule when multiple rules exist", () => {
  const service = new DomainInteractionPolicyService();
  const rule1: DomainInteractionRule = {
    sourceDomainId: "coding",
    targetDomainId: "security",
    mode: "deny",
    maxConcurrentWorkflows: 5,
    compensationRequired: false,
  };
  const rule2: DomainInteractionRule = {
    sourceDomainId: "data",
    targetDomainId: "security",
    mode: "allow",
    maxConcurrentWorkflows: 10,
    compensationRequired: false,
  };
  // request is for "coding" -> "security", should match rule1
  const decision = service.evaluate([rule1, rule2], sampleRequest);
  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.reasonCodes, ["domain_interaction.denied"]);
});

test("evaluate handles exact concurrent count equal to max", () => {
  const service = new DomainInteractionPolicyService();
  const request: DomainInteractionRequest = { ...sampleRequest, concurrentWorkflowCount: 3 };
  const decision = service.evaluate([sampleRule], request);
  assert.equal(decision.allowed, true);
});

test("evaluate handles concurrent count of zero", () => {
  const service = new DomainInteractionPolicyService();
  const request: DomainInteractionRequest = { ...sampleRequest, concurrentWorkflowCount: 0 };
  const decision = service.evaluate([sampleRule], request);
  assert.equal(decision.allowed, true);
});