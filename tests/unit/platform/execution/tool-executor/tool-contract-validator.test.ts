import assert from "node:assert/strict";
import test from "node:test";

import {
  validateToolExecutionMetadata,
  validateToolMetadataRegistry,
} from "../../../../../src/platform/five-plane-execution/tool-executor/tool-contract-validator.js";
import type { ToolExecutionMetadata } from "../../../../../src/platform/five-plane-execution/tool-executor/tool-metadata.js";

function createValidMetadata(overrides: Partial<ToolExecutionMetadata> = {}): ToolExecutionMetadata {
  return {
    toolName: "test_tool",
    readOnly: false,
    idempotent: false,
    sideEffectScope: "local_file",
    recoveryStrategy: "retry_safe",
    requiresConfirmation: false,
    riskLevel: "medium",
    needsFileLock: "none",
    pathScopeMode: "none",
    producesArtifact: false,
    outputKind: "text",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 30_000,
    retryableErrorCodes: [],
    approvalMode: "never",
    supportsCancellation: false,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: true,
    highRiskPatterns: [],
    ...overrides,
  };
}

test("validateToolExecutionMetadata passes for valid metadata", () => {
  const metadata = createValidMetadata();
  const violations = validateToolExecutionMetadata(metadata);
  assert.deepEqual(violations, []);
});

test("validateToolExecutionMetadata detects missing tool name", () => {
  const metadata = createValidMetadata({ toolName: "   " });
  const violations = validateToolExecutionMetadata(metadata);

  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.code, "tool_name_missing");
});

test("validateToolExecutionMetadata detects invalid default timeout", () => {
  const metadata = createValidMetadata({ defaultTimeoutMs: 0 });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(violations.some((v) => v.code === "default_timeout_invalid"));
});

test("validateToolExecutionMetadata detects negative timeout", () => {
  const metadata = createValidMetadata({ defaultTimeoutMs: -1000 });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(violations.some((v) => v.code === "default_timeout_invalid"));
});

test("validateToolExecutionMetadata detects invalid max output", () => {
  const metadata = createValidMetadata({ maxOutputBytes: 0 });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(violations.some((v) => v.code === "max_output_invalid"));
});

test("validateToolExecutionMetadata detects invalid retryable error code", () => {
  const metadata = createValidMetadata({ retryableErrorCodes: ["", "valid"] as any });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(violations.some((v) => v.code === "retryable_error_codes_invalid"));
});

test("validateToolExecutionMetadata detects duplicate retryable error codes", () => {
  const metadata = createValidMetadata({ retryableErrorCodes: ["error1", "error1", "error2"] });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(violations.some((v) => v.code === "retryable_error_codes_duplicate"));
});

test("validateToolExecutionMetadata detects read-only with side effects", () => {
  const metadata = createValidMetadata({ readOnly: true, sideEffectScope: "local_file" });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(violations.some((v) => v.code === "read_only_side_effect_mismatch"));
});

test("validateToolExecutionMetadata allows read-only with no side effects", () => {
  const metadata = createValidMetadata({ readOnly: true, sideEffectScope: "none" });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(!violations.some((v) => v.code === "read_only_side_effect_mismatch"));
});

test("validateToolExecutionMetadata detects read-only with write lock", () => {
  const metadata = createValidMetadata({ readOnly: true, needsFileLock: "write" });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(violations.some((v) => v.code === "read_only_lock_mismatch"));
});

test("validateToolExecutionMetadata detects read-only with dynamic lock", () => {
  const metadata = createValidMetadata({ readOnly: true, needsFileLock: "dynamic" });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(violations.some((v) => v.code === "read_only_lock_mismatch"));
});

test("validateToolExecutionMetadata allows read-only with read lock", () => {
  const metadata = createValidMetadata({ readOnly: true, needsFileLock: "read" });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(!violations.some((v) => v.code === "read_only_lock_mismatch"));
});

test("validateToolExecutionMetadata detects artifact without artifact output", () => {
  const metadata = createValidMetadata({ producesArtifact: true, outputKind: "text" });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(violations.some((v) => v.code === "artifact_output_mismatch"));
});

test("validateToolExecutionMetadata allows artifact with artifact_ref output", () => {
  const metadata = createValidMetadata({ producesArtifact: true, outputKind: "artifact_ref" });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(!violations.some((v) => v.code === "artifact_output_mismatch"));
});

test("validateToolExecutionMetadata allows artifact with mixed output", () => {
  const metadata = createValidMetadata({ producesArtifact: true, outputKind: "mixed" });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(!violations.some((v) => v.code === "artifact_output_mismatch"));
});

test("validateToolExecutionMetadata detects mutable tool without execution receipt", () => {
  const metadata = createValidMetadata({ readOnly: false, requiresExecutionReceipt: false });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(violations.some((v) => v.code === "mutable_execution_receipt_required"));
});

test("validateToolExecutionMetadata allows mutable tool with execution receipt", () => {
  const metadata = createValidMetadata({ readOnly: false, requiresExecutionReceipt: true });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(!violations.some((v) => v.code === "mutable_execution_receipt_required"));
});

test("validateToolExecutionMetadata allows read-only tool without execution receipt", () => {
  const metadata = createValidMetadata({ readOnly: true, requiresExecutionReceipt: false });
  const violations = validateToolExecutionMetadata(metadata);

  assert.ok(!violations.some((v) => v.code === "mutable_execution_receipt_required"));
});

test("validateToolMetadataRegistry aggregates violations from multiple tools", () => {
  const metadata1 = createValidMetadata({ toolName: "tool1", defaultTimeoutMs: 0 });
  const metadata2 = createValidMetadata({ toolName: "tool2", readOnly: true, sideEffectScope: "local_file" });

  const violations = validateToolMetadataRegistry([metadata1, metadata2]);

  assert.ok(violations.some((v) => v.toolName === "tool1" && v.code === "default_timeout_invalid"));
  assert.ok(violations.some((v) => v.toolName === "tool2" && v.code === "read_only_side_effect_mismatch"));
});

test("validateToolMetadataRegistry returns empty for valid registry", () => {
  const metadata1 = createValidMetadata({ toolName: "tool1" });
  const metadata2 = createValidMetadata({ toolName: "tool2" });

  const violations = validateToolMetadataRegistry([metadata1, metadata2]);

  assert.deepEqual(violations, []);
});
