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
  type PolicyDecision,
  type PolicyEffect,
} from "../../../../src/platform/five-plane-control-plane/iam/policy-engine.js";

import {
  SecretManagementService,
  type SecretValue,
  type SecretLease,
} from "../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";

import {
  DataClassificationService,
  type DataClassification,
  type ClassificationLevel,
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
  assert.equal(result.reasonCode, "sandbox.path_outside_allowed_roots");
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

test("PolicyEngine evaluates allow decision", () => {
  const engine = new PolicyEngine();

  const request: PolicyDecisionRequest = {
    decisionId: "dec_001",
    subjectType: "user",
    subjectId: "user_123",
    action: "read_file",
    resourceRef: "/workspace/public/readme.txt",
    riskLevel: "low",
    mode: "auto",
  };

  const decision = engine.evaluate(request);

  assert.equal(decision.effect, "allow");
  assert.ok(decision.reasonCode.length > 0);
});

test("PolicyEngine evaluates deny decision for high risk", () => {
  const engine = new PolicyEngine();

  const request: PolicyDecisionRequest = {
    decisionId: "dec_002",
    subjectType: "user",
    subjectId: "user_123",
    action: "delete_resource",
    resourceRef: "/workspace/prod/database",
    riskLevel: "critical",
    mode: "auto",
  };

  const decision = engine.evaluate(request);

  assert.equal(decision.effect, "deny");
});

test("PolicyEngine enforces read-only mode", () => {
  const engine = new PolicyEngine();

  const request: PolicyDecisionRequest = {
    decisionId: "dec_003",
    subjectType: "user",
    subjectId: "user_123",
    action: "write_file",
    resourceRef: "/workspace/file.txt",
    riskLevel: "low",
    mode: "read_only",
  };

  const decision = engine.evaluate(request);

  assert.equal(decision.effect, "deny");
  assert.ok(decision.reasonCode.includes("read_only"));
});

// ============================================================================
// Secret Management Service Tests
// ============================================================================

test("SecretManagementService stores and retrieves secret", () => {
  const service = new SecretManagementService();

  const stored = service.store("tenant_123", {
    name: "api_key",
    value: "sk-1234567890abcdef",
    secretType: "api_key",
  });

  assert.ok(stored.secretId.length > 0);

  const retrieved = service.retrieve("tenant_123", stored.secretId);

  assert.equal(retrieved?.name, "api_key");
  assert.equal(retrieved.value, "sk-1234567890abcdef");
});

test("SecretManagementService issues lease", () => {
  const service = new SecretManagementService();

  const stored = service.store("tenant_123", {
    name: "db_password",
    value: "secret123",
    secretType: "password",
  });

  const lease = service.issueLease("tenant_123", stored.secretId, {
    ttlSeconds: 3600,
    purpose: "database_connection",
  });

  assert.ok(lease.leaseId.length > 0);
  assert.ok(lease.expiresAt.length > 0);
  assert.equal(lease.released, false);
});

test("SecretManagementService releases lease", () => {
  const service = new SecretManagementService();

  const stored = service.store("tenant_123", {
    name: "token",
    value: "abc123",
    secretType: "token",
  });

  const lease = service.issueLease("tenant_123", stored.secretId, {
    ttlSeconds: 3600,
    purpose: "api_call",
  });

  const released = service.releaseLease("tenant_123", lease.leaseId);

  assert.equal(released.success, true);
  assert.equal(released.lease.released, true);
});

test("SecretManagementService denies access after lease expiry", () => {
  const service = new SecretManagementService();

  const stored = service.store("tenant_123", {
    name: "temp_token",
    value: "temp123",
    secretType: "token",
  });

  const lease = service.issueLease("tenant_123", stored.secretId, {
    ttlSeconds: 0,
    purpose: "short_lived",
  });

  const retrieved = service.retrieveWithLease("tenant_123", stored.secretId, lease.leaseId);

  assert.equal(retrieved, null);
});

// ============================================================================
// Data Classification Service Tests
// ============================================================================

test("DataClassificationService classifies PII data", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "email_address",
    context: "user_contact",
  });

  assert.equal(classification.level, ClassificationLevel.PII);
  assert.ok(classification.tags.includes("personal_data"));
});

test("DataClassificationService classifies sensitive financial data", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "credit_card_number",
    context: "payment_processing",
  });

  assert.equal(classification.level, ClassificationLevel.SENSITIVE);
  assert.ok(classification.tags.includes("financial_data"));
});

test("DataClassificationService classifies public data", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "public_announcement",
    context: "marketing",
  });

  assert.equal(classification.level, ClassificationLevel.PUBLIC);
});

test("DataClassificationService enforces handling requirements", () => {
  const service = new DataClassificationService();

  const classification = service.classify({
    dataType: "social_security_number",
    context: "tax_reporting",
  });

  const requirements = service.getHandlingRequirements(classification);

  assert.ok(requirements.encryptionRequired === true);
  assert.ok(requirements.auditRequired === true);
  assert.ok(requirements.retentionPeriodDays !== null);
});
