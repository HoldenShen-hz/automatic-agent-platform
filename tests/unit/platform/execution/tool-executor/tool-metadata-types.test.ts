import assert from "node:assert/strict";
import test from "node:test";

import type {
  ToolSideEffectScope,
  ToolRecoveryStrategy,
  ToolRetryPolicy,
  ToolNeedsFileLock,
  ToolPathScopeMode,
  ToolOutputKind,
  ToolApprovalMode,
  ToolRiskLevel,
  ToolExecutionMetadata,
} from "../../../../../src/platform/execution/tool-executor/tool-metadata.js";

test("ToolSideEffectScope accepts all valid values", () => {
  const scopes: ToolSideEffectScope[] = ["none", "local_file", "local_process", "remote_api", "billing", "org_state"];
  assert.equal(scopes.length, 6);
});

test("ToolRecoveryStrategy accepts all valid values", () => {
  const strategies: ToolRecoveryStrategy[] = ["retry_safe", "retry_with_check", "skip_if_verified", "manual_resume_required"];
  assert.equal(strategies.length, 4);
});

test("ToolNeedsFileLock accepts all valid values", () => {
  const locks: ToolNeedsFileLock[] = ["none", "read", "write", "dynamic"];
  assert.equal(locks.length, 4);
});

test("ToolPathScopeMode accepts all valid values", () => {
  const modes: ToolPathScopeMode[] = ["none", "declared", "dynamic"];
  assert.equal(modes.length, 3);
});

test("ToolOutputKind accepts all valid values", () => {
  const kinds: ToolOutputKind[] = ["text", "structured_json", "artifact_ref", "mixed"];
  assert.equal(kinds.length, 4);
});

test("ToolApprovalMode accepts all valid values", () => {
  const modes: ToolApprovalMode[] = ["never", "policy_driven", "always"];
  assert.equal(modes.length, 3);
});

test("ToolRiskLevel accepts all valid values", () => {
  const levels: ToolRiskLevel[] = ["low", "medium", "high", "critical"];
  assert.equal(levels.length, 4);
});

test("ToolRetryPolicy structure is correct", () => {
  const policy: ToolRetryPolicy = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2.0,
    nonRetryableCodes: ["ENOENT", "EACCES"],
  };
  assert.equal(policy.maxAttempts, 3);
  assert.equal(policy.backoffMultiplier, 2.0);
});

test("ToolRetryPolicy allows minimal definition", () => {
  const policy: ToolRetryPolicy = {};
  assert.equal(policy.maxAttempts, undefined);
  assert.equal(policy.initialDelayMs, undefined);
});

test("ToolRetryPolicy allows partial fields", () => {
  const policy: ToolRetryPolicy = {
    maxAttempts: 5,
  };
  assert.equal(policy.maxAttempts, 5);
  assert.equal(policy.nonRetryableCodes, undefined);
});

test("ToolExecutionMetadata structure is correct", () => {
  const metadata: ToolExecutionMetadata = {
    toolName: "command_exec",
    readOnly: false,
    idempotent: false,
    sideEffectScope: "local_process",
    recoveryStrategy: "retry_safe",
    requiresConfirmation: true,
    riskLevel: "high",
    needsFileLock: "write",
    pathScopeMode: "declared",
    producesArtifact: false,
    outputKind: "text",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 60000,
    retryableErrorCodes: ["ETIMEDOUT", "ECONNRESET"],
    approvalMode: "policy_driven",
    supportsCancellation: true,
    cleanupGuarantee: "best_effort",
    requiresExecutionReceipt: true,
    highRiskPatterns: [/sudo/, /rm\s+-rf/],
  };
  assert.equal(metadata.toolName, "command_exec");
  assert.equal(metadata.riskLevel, "high");
  assert.equal(metadata.defaultTimeoutMs, 60000);
});

test("ToolExecutionMetadata allows minimal definition", () => {
  const metadata: ToolExecutionMetadata = {
    toolName: "minimal_tool",
    readOnly: true,
    idempotent: true,
    sideEffectScope: "none",
    recoveryStrategy: "retry_safe",
    requiresConfirmation: false,
    riskLevel: "low",
    needsFileLock: "none",
    pathScopeMode: "none",
    producesArtifact: false,
    outputKind: "text",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 30000,
    retryableErrorCodes: [],
    approvalMode: "never",
    supportsCancellation: false,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: false,
    highRiskPatterns: [],
  };
  assert.equal(metadata.toolName, "minimal_tool");
  assert.equal(metadata.maxOutputBytes, undefined);
});

test("ToolExecutionMetadata allows optional fields", () => {
  const metadata: ToolExecutionMetadata = {
    toolName: "optional_tool",
    readOnly: false,
    idempotent: true,
    sideEffectScope: "local_file",
    recoveryStrategy: "skip_if_verified",
    requiresConfirmation: false,
    riskLevel: "medium",
    needsFileLock: "read",
    pathScopeMode: "dynamic",
    producesArtifact: true,
    outputKind: "artifact_ref",
    supportsStreamingOutput: true,
    providerDependency: "optional",
    defaultTimeoutMs: 120000,
    maxOutputBytes: 1024 * 1024,
    retryableErrorCodes: ["ECONNREFUSED"],
    approvalMode: "never",
    supportsCancellation: true,
    cleanupGuarantee: "required",
    requiresExecutionReceipt: true,
    highRiskPatterns: [],
    isConcurrencySafe: true,
    interruptBehavior: "graceful",
    isLongRunning: true,
    retryPolicy: {
      maxAttempts: 2,
      initialDelayMs: 500,
    },
    maxResultSizeChars: 50000,
  };
  assert.equal(metadata.maxOutputBytes, 1024 * 1024);
  assert.equal(metadata.isConcurrencySafe, true);
  assert.equal(metadata.interruptBehavior, "graceful");
});

test("ToolExecutionMetadata cleanupGuarantee accepts all valid values", () => {
  const guarantees: ToolExecutionMetadata["cleanupGuarantee"][] = ["none", "best_effort", "required"];
  assert.equal(guarantees.length, 3);
});

test("ToolExecutionMetadata providerDependency accepts all valid values", () => {
  const deps: ToolExecutionMetadata["providerDependency"][] = ["none", "optional", "required"];
  assert.equal(deps.length, 3);
});

test("ToolExecutionMetadata interruptBehavior accepts all valid values", () => {
  const behaviors: ToolExecutionMetadata["interruptBehavior"][] = ["graceful", "forceful", "deferred"];
  assert.equal(behaviors.length, 3);
});
