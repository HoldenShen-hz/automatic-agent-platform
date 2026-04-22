import test from "node:test";
import assert from "node:assert/strict";

import {
  FailureMode,
  FailureCategory,
} from "../../../../../../src/platform/orchestration/oapeflir/types/failure-mode.js";

test("FailureCategory accepts all valid categories", () => {
  const categories: FailureCategory[] = [
    "tool_execution",
    "validation",
    "resource_exhaustion",
    "dependency",
    "timeout",
    "auth_permission",
    "network",
    "data_quality",
    "planning",
    "unknown",
  ];
  for (const category of categories) {
    const failureMode: FailureMode = {
      failureModeId: `test-${category}`,
      category,
      name: "Test failure",
      description: "Test description",
      rootCauses: [],
      contextBeforeFailure: [],
      errorCodePattern: "TEST_.*",
      severity: "medium",
      recoverable: true,
      tags: ["test"],
    };
    assert.equal(failureMode.category, category);
  }
});

test("FailureMode can be constructed with all required fields", () => {
  const failureMode: FailureMode = {
    failureModeId: "fm_001",
    category: "tool_execution",
    name: "Tool timeout",
    description: "Tool execution exceeded timeout",
    rootCauses: ["slow_external_api", "network_latency"],
    contextBeforeFailure: ["invoked_tool", "waited_30s"],
    errorCodePattern: "TOOL_TIMEOUT_.*",
    severity: "high",
    recoverable: true,
    recoveryStrategy: "retry_with_backoff",
    tags: ["timeout", "external"],
  };

  assert.equal(failureMode.failureModeId, "fm_001");
  assert.equal(failureMode.name, "Tool timeout");
  assert.deepEqual(failureMode.rootCauses, ["slow_external_api", "network_latency"]);
  assert.equal(failureMode.severity, "high");
  assert.equal(failureMode.recoverable, true);
  assert.equal(failureMode.recoveryStrategy, "retry_with_backoff");
});

test("FailureMode severity levels", () => {
  const severities: FailureMode["severity"][] = ["low", "medium", "high", "critical"];
  for (const severity of severities) {
    const failureMode: FailureMode = {
      failureModeId: `fm_sev`,
      category: "unknown",
      name: "Test",
      description: "Test",
      rootCauses: [],
      contextBeforeFailure: [],
      errorCodePattern: ".*",
      severity,
      recoverable: false,
      tags: [],
    };
    assert.equal(failureMode.severity, severity);
  }
});

test("FailureMode can have optional recoveryStrategy omitted", () => {
  const failureMode: FailureMode = {
    failureModeId: "fm_no_recovery",
    category: "data_quality",
    name: "Data corruption",
    description: "Input data is corrupted",
    rootCauses: ["upstream_service_bug"],
    contextBeforeFailure: ["received_payload"],
    errorCodePattern: "DATA_CORRUPT.*",
    severity: "critical",
    recoverable: false,
    tags: ["data", "corruption"],
  };

  assert.equal(failureMode.recoverable, false);
  assert.equal(failureMode.recoveryStrategy, undefined);
});

test("FailureMode with empty arrays for rootCauses and contextBeforeFailure", () => {
  const failureMode: FailureMode = {
    failureModeId: "fm_empty",
    category: "planning",
    name: "Planning failure",
    description: "Planner could not generate valid plan",
    rootCauses: [],
    contextBeforeFailure: [],
    errorCodePattern: "PLAN_FAIL.*",
    severity: "medium",
    recoverable: false,
    tags: [],
  };

  assert.deepEqual(failureMode.rootCauses, []);
  assert.deepEqual(failureMode.contextBeforeFailure, []);
  assert.deepEqual(failureMode.tags, []);
});

test("FailureMode with many tags", () => {
  const failureMode: FailureMode = {
    failureModeId: "fm_tags",
    category: "auth_permission",
    name: "Permission denied",
    description: "Insufficient permissions to complete operation",
    rootCauses: ["missing_role"],
    contextBeforeFailure: ["checked_permissions"],
    errorCodePattern: "AUTH_.*",
    severity: "high",
    recoverable: true,
    tags: ["auth", "permission", "security", "access_control", "iam"],
  };

  assert.equal(failureMode.tags.length, 5);
  assert.ok(failureMode.tags.includes("security"));
});