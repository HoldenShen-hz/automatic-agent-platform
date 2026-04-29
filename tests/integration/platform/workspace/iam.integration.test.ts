/**
 * Integration Tests: IAM
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSandboxPath,
  createWorkspaceWritePolicy,
  createScopedExternalAccessPolicy,
  type SandboxPolicy,
} from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

import {
  PolicyEngine,
  type PolicyDecisionRequest,
} from "../../../../../src/platform/five-plane-control-plane/iam/policy-engine.js";

import {
  SecretManagementService,
} from "../../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";

import {
  DataClassificationService,
  ClassificationLevel,
} from "../../../../../src/platform/five-plane-control-plane/iam/data-classification-service.js";

// ============================================================================
// IAM End-to-End Integration Tests
// ============================================================================

test("integration: sandbox policy with policy engine enforcement", () => {
  const policy = createWorkspaceWritePolicy("/workspace/project");

  const writeRequest: PolicyDecisionRequest = {
    decisionId: "dec_sandbox_001",
    subjectType: "user",
    subjectId: "user_001",
    action: "write_file",
    resourceRef: "/workspace/project/src/index.ts",
    riskLevel: "low",
    mode: "auto",
  };

  const allowedResult = checkSandboxPath(policy, writeRequest.resourceRef!);
  assert.equal(allowedResult.allowed, true);

  const policyEngine = new PolicyEngine();
  const policyDecision = policyEngine.evaluate(writeRequest);
  assert.equal(policyDecision.effect, "allow");
});

test("integration: secret management with lease lifecycle", () => {
  const service = new SecretManagementService();

  const stored = service.store("tenant_iam_001", {
    name: "db_credentials",
    value: "super_secret_password",
    secretType: "password",
  });

  const lease = service.issueLease("tenant_iam_001", stored.secretId, {
    ttlSeconds: 3600,
    purpose: "database_connection",
  });

  const retrieved = service.retrieveWithLease("tenant_iam_001", stored.secretId, lease.leaseId);
  assert.equal(retrieved?.value, "super_secret_password");

  service.releaseLease("tenant_iam_001", lease.leaseId);

  const released = service.retrieveWithLease("tenant_iam_001", stored.secretId, lease.leaseId);
  assert.equal(released, null);
});

test("integration: data classification with handling requirements", () => {
  const classificationService = new DataClassificationService();

  const piiData = classificationService.classify({
    dataType: "email_address",
    context: "user_contact",
  });

  const requirements = classificationService.getHandlingRequirements(piiData);

  assert.equal(requirements.encryptionRequired, true);
  assert.equal(requirements.auditRequired, true);

  classificationService.recordAccess({
    dataType: "email_address",
    accessedBy: "user_001",
    accessType: "read",
    timestamp: new Date().toISOString(),
  });

  const accessLog = classificationService.getAccessLog("email_address");
  assert.ok(accessLog.length >= 1);
});

test("integration: scoped external access with network policy", () => {
  const policy = createScopedExternalAccessPolicy("/workspace");

  const internalPath = checkSandboxPath(policy, "/workspace/internal/api.txt");
  assert.equal(internalPath.allowed, true);

  const externalPath = checkSandboxPath(policy, "/etc/config/secrets.txt");
  assert.equal(externalPath.allowed, false);
});

test("integration: policy engine with sandbox path validation", () => {
  const policy = createWorkspaceWritePolicy("/workspace");

  const engine = new PolicyEngine();

  const readRequest: PolicyDecisionRequest = {
    decisionId: "dec_path_001",
    subjectType: "user",
    subjectId: "user_002",
    action: "read_file",
    resourceRef: "/workspace/safe/file.txt",
    riskLevel: "low",
    mode: "auto",
  };

  const pathResult = checkSandboxPath(policy, readRequest.resourceRef!);
  const policyResult = engine.evaluate(readRequest);

  assert.equal(pathResult.allowed, true);
  assert.equal(policyResult.effect, "allow");

  const writeRequest: PolicyDecisionRequest = {
    decisionId: "dec_path_002",
    subjectType: "user",
    subjectId: "user_002",
    action: "write_file",
    resourceRef: "/workspace/safe/file.txt",
    riskLevel: "medium",
    mode: "auto",
  };

  const writeResult = engine.evaluate(writeRequest);
  assert.equal(writeResult.effect, "allow");
});

test("integration: multiple secrets with separate leases", () => {
  const service = new SecretManagementService();

  const secret1 = service.store("tenant_multi_001", {
    name: "api_key_1",
    value: "key_abc",
    secretType: "api_key",
  });

  const secret2 = service.store("tenant_multi_001", {
    name: "api_key_2",
    value: "key_xyz",
    secretType: "api_key",
  });

  const lease1 = service.issueLease("tenant_multi_001", secret1.secretId, {
    ttlSeconds: 3600,
    purpose: "api_call_1",
  });

  const lease2 = service.issueLease("tenant_multi_001", secret2.secretId, {
    ttlSeconds: 7200,
    purpose: "api_call_2",
  });

  const retrieved1 = service.retrieveWithLease("tenant_multi_001", secret1.secretId, lease1.leaseId);
  const retrieved2 = service.retrieveWithLease("tenant_multi_001", secret2.secretId, lease2.leaseId);

  assert.equal(retrieved1?.value, "key_abc");
  assert.equal(retrieved2?.value, "key_xyz");

  service.releaseLease("tenant_multi_001", lease1.leaseId);

  const afterRelease1 = service.retrieveWithLease("tenant_multi_001", secret1.secretId, lease1.leaseId);
  const stillValid2 = service.retrieveWithLease("tenant_multi_001", secret2.secretId, lease2.leaseId);

  assert.equal(afterRelease1, null);
  assert.ok(stillValid2 !== null);
});
