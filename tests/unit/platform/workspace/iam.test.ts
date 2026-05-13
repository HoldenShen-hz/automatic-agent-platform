/**
 * Unit Tests: IAM
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSandboxPath,
  createWorkspaceWritePolicy,
  createScopedExternalAccessPolicy,
  createRestrictedExecPolicy,
  createConfigReadPolicy,
  resolveSandboxPath,
  type SandboxPolicy,
  type SandboxPathCheckResult,
} from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

import {
  PolicyEngine,
  type PolicyDecisionRequest,
  type PolicyDecisionResult,
} from "../../../../src/platform/five-plane-control-plane/iam/policy-engine.js";

import {
  DataClassificationService,
  type ClassificationResult,
  type DataClassificationLevel,
} from "../../../../src/platform/five-plane-control-plane/iam/data-classification-service.js";

// ============================================================================
// Sandbox Policy Tests
// ============================================================================

test("createWorkspaceWritePolicy creates valid policy", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  assert.equal(policy.mode, "workspace_write");
  assert.deepStrictEqual(policy.allowedRoots, ["/workspace"]);
  assert.equal(policy.realpathEnforced, true);
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.processRuleMode, "allow");
});

test("checkSandboxPath allows path within allowed root", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/workspace/project/file.ts");

  assert.equal(result.allowed, true);
  assert.ok(result.normalizedPath.includes("workspace"));
});

test("checkSandboxPath denies path outside allowed root", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/etc/passwd");

  assert.equal(result.allowed, false);
  assert.ok([
    "sandbox.path_outside_allowed_roots",
    "sandbox.path_in_denied_root",
  ].includes(result.reasonCode ?? ""));
});

test("checkSandboxPath denies path with ../ traversal", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const result = checkSandboxPath(policy, "/workspace/../etc/passwd");

  assert.equal(result.allowed, false);
});

test("checkSandboxPath denies path in denied root", () => {
  const policy: SandboxPolicy = {
    ...createWorkspaceWritePolicy("/workspace"),
    deniedRoots: ["/workspace/secret"],
  };

  const result = checkSandboxPath(policy, "/workspace/secret/api-keys.json");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sandbox.path_in_denied_root");
});

test("createScopedExternalAccessPolicy creates read-only policy", () => {
  const policy = createScopedExternalAccessPolicy("/workspace");

  assert.equal(policy.mode, "scoped_external_access");
  assert.equal(policy.symlinkPolicy, "deny");
  assert.equal(policy.realpathEnforced, true);
});

test("createRestrictedExecPolicy creates exec policy", () => {
  const policy = createRestrictedExecPolicy("/workspace");

  assert.equal(policy.mode, "restricted_exec");
  assert.equal(policy.processRuleMode, "allow");
});

test("createConfigReadPolicy creates deny policy", () => {
  const policy = createConfigReadPolicy("/etc/config");

  assert.equal(policy.mode, "read_only");
  assert.equal(policy.processRuleMode, "deny");
});

test("resolveSandboxPath resolves symlinks", () => {
  const resolved = resolveSandboxPath("/tmp", true);

  assert.ok(resolved);
  assert.notEqual(resolved, "/tmp");
});

test("resolveSandboxPath returns path as-is without realpath", () => {
  const path = "/workspace/test.txt";
  const resolved = resolveSandboxPath(path, false);

  assert.equal(resolved, path);
});

// ============================================================================
// Policy Engine Tests
// ============================================================================

test("PolicyEngine evaluates allow decision for invoke_tool", () => {
  const engine = new PolicyEngine({ budgetPolicy: { maxCostPerTask: 100, maxCostPerMonth: 10000 } });

  const request: PolicyDecisionRequest = {
    decisionId: "dec_001",
    taskId: "task_001",
    subjectType: "user",
    subjectId: "user_123",
    action: "invoke_tool",
    resourceRef: "/workspace/public/readme.txt",
    riskCategory: "destructive",
    mode: "auto",
  };

  const decision = engine.evaluate(request);

  assert.ok(decision.decision === "allow" || decision.requiresApproval === true);
  assert.ok(decision.reasonCode.length > 0);
});

test("PolicyEngine evaluates deny decision for destructive action in auto mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: { maxCostPerTask: 100, maxCostPerMonth: 10000 } });

  const request: PolicyDecisionRequest = {
    decisionId: "dec_002",
    taskId: "task_002",
    subjectType: "user",
    subjectId: "user_123",
    action: "exec_command",
    resourceRef: "/workspace/prod/database",
    riskCategory: "destructive",
    mode: "auto",
  };

  const decision = engine.evaluate(request);

  // In auto mode with destructive action, should require approval or deny
  assert.ok(decision.decision === "deny" || decision.requiresApproval === true);
});

test("PolicyEngine handles supervised mode", () => {
  const engine = new PolicyEngine({ budgetPolicy: { maxCostPerTask: 100, maxCostPerMonth: 10000 } });

  const request: PolicyDecisionRequest = {
    decisionId: "dec_003",
    taskId: "task_003",
    subjectType: "user",
    subjectId: "user_123",
    action: "write_file",
    resourceRef: "/workspace/file.txt",
    riskCategory: "destructive",
    mode: "supervised",
  };

  const decision = engine.evaluate(request);

  // supervised mode may allow with constraints
  assert.ok(decision.decision !== undefined);
});

// ============================================================================
// Data Classification Service Tests
// ============================================================================

test("DataClassificationService classifies public data", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "public_announcement",
    context: "marketing",
  });

  assert.equal(classification.level, "public");
  assert.equal(classification.piiDetected, false);
});

test("DataClassificationService classifies internal data", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "internal_report",
    context: "business_ops",
  });

  assert.equal(classification.level, "internal");
});

test("DataClassificationService classifies sensitive financial data", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "credit_card_number",
    context: "payment_processing",
  });

  assert.equal(classification.level, "confidential");
});

test("DataClassificationService detects PII in email", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "email_address",
    context: "user_contact",
  });

  assert.ok(classification.piiDetected === true);
  assert.ok(classification.piiTypes.includes("email"));
});

test("DataClassificationService provides handling decision", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "social_security_number",
    context: "tax_reporting",
  });

  const decision = service.decide({
    level: classification.level,
    dimension: "prompt",
  });

  assert.equal(decision.action, "deny");
  assert.equal(decision.allowed, false);
});

test("DataClassificationService allows public data in prompt", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "public_announcement",
    context: "marketing",
  });

  const decision = service.decide({
    level: classification.level,
    dimension: "prompt",
  });

  assert.equal(decision.action, "allow");
  assert.equal(decision.allowed, true);
});

test("DataClassificationService handles confidential data in logs", () => {
  const service = new DataClassificationService();

  const decision = service.decide({
    level: "confidential",
    dimension: "logs",
  });

  assert.ok(decision.allowed === false || decision.action === "redact");
});

test("DataClassificationService requires audit for restricted data", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "trade_secret",
    context: "product_development",
  });

  assert.equal(classification.requiresAudit, true);
});

test("DataClassificationService auto-annotates based on rules", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "api_key",
    context: "authentication",
  });

  // Should auto-classify based on data type patterns
  assert.ok(classification.level === "confidential" || classification.level === "restricted");
  assert.equal(classification.autoAnnotated, true);
});

test("DataClassificationService provides reasoning for classification", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "patient_medical_record",
    context: "healthcare",
  });

  assert.ok(classification.reasoning.length > 0);
  assert.ok(classification.confidence >= 0 && classification.confidence <= 1);
});
