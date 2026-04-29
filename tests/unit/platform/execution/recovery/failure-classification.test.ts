import assert from "node:assert/strict";
import test from "node:test";

import {
  FailureLevel,
  FailureCategory,
  FailureContext,
  FAILURE_CLASSIFICATION,
  classifyErrorCode,
  classifyFailure,
  classifyFailureFromErrorCode,
  shouldEscalate,
} from "../../../../../src/platform/execution/recovery/failure-classification.js";

test("FailureLevel type accepts transient", () => {
  const level: FailureLevel = "transient";
  assert.equal(level, "transient");
});

test("FailureLevel type accepts unknown", () => {
  const level: FailureLevel = "unknown";
  assert.equal(level, "unknown");
});

test("FailureLevel type accepts permanent", () => {
  const level: FailureLevel = "permanent";
  assert.equal(level, "permanent");
});

test("classifyErrorCode returns validation_error for null", () => {
  const result = classifyErrorCode(null);
  assert.equal(result, "validation_error");
});

test("classifyErrorCode returns validation_error for empty string", () => {
  const result = classifyErrorCode("");
  assert.equal(result, "validation_error");
});

test("classifyErrorCode returns resource_exhausted for resource_exhausted", () => {
  assert.equal(classifyErrorCode("resource_exhausted"), "resource_exhausted");
  assert.equal(classifyErrorCode("RESOURCE_EXHAUSTED"), "resource_exhausted");
  assert.equal(classifyErrorCode("resource-exhausted"), "resource_exhausted");
  assert.equal(classifyErrorCode("resource_exhaust"), "resource_exhausted");
});

test("classifyErrorCode returns resource_exhausted for out_of_memory", () => {
  assert.equal(classifyErrorCode("out_of_memory"), "resource_exhausted");
  assert.equal(classifyErrorCode("OUT_OF_MEMORY"), "resource_exhausted");
});

test("classifyErrorCode returns resource_exhausted for memory errors", () => {
  assert.equal(classifyErrorCode("memory_error"), "resource_exhausted");
  assert.equal(classifyErrorCode("insufficient_memory"), "resource_exhausted");
});

test("classifyErrorCode returns timeout_exceeded for timeout", () => {
  assert.equal(classifyErrorCode("timeout"), "timeout_exceeded");
  assert.equal(classifyErrorCode("TIMEOUT"), "timeout_exceeded");
  assert.equal(classifyErrorCode("execution_timeout"), "timeout_exceeded");
  assert.equal(classifyErrorCode("timed_out"), "timeout_exceeded");
});

test("classifyErrorCode returns dependency_unavailable for dependency unavailable", () => {
  assert.equal(classifyErrorCode("dependency_unavailable"), "dependency_unavailable");
  assert.equal(classifyErrorCode("dependency_not_found"), "dependency_unavailable");
  assert.equal(classifyErrorCode("DEPENDENCY_UNAVAILABLE"), "dependency_unavailable");
});

test("classifyErrorCode returns quota_exceeded for quota errors", () => {
  assert.equal(classifyErrorCode("quota_exceeded"), "quota_exceeded");
  assert.equal(classifyErrorCode("limit_reached"), "quota_exceeded");
  assert.equal(classifyErrorCode("cap_reached"), "quota_exceeded");
  assert.equal(classifyErrorCode("QUOTA_EXCEEDED"), "quota_exceeded");
});

test("classifyErrorCode returns rate_limit_exceeded for rate limit errors", () => {
  assert.equal(classifyErrorCode("rate_limit_exceeded"), "rate_limit_exceeded");
  assert.equal(classifyErrorCode("too_many_requests"), "rate_limit_exceeded");
  assert.equal(classifyErrorCode("RATE_LIMIT_EXCEEDED"), "rate_limit_exceeded");
});

test("classifyErrorCode returns circuit_breaker_open for circuit breaker errors", () => {
  assert.equal(classifyErrorCode("circuit_breaker_open"), "circuit_breaker_open");
  assert.equal(classifyErrorCode("circuit_breaker"), "circuit_breaker_open");
  assert.equal(classifyErrorCode("breaker_triggered"), "circuit_breaker_open");
});

test("classifyErrorCode returns concurrency_limit_exceeded for concurrency errors", () => {
  assert.equal(classifyErrorCode("concurrency_limit_exceeded"), "concurrency_limit_exceeded");
  assert.equal(classifyErrorCode("too_many_parallel"), "concurrency_limit_exceeded");
  assert.equal(classifyErrorCode("concurrency_error"), "concurrency_limit_exceeded");
});

test("classifyErrorCode returns validation_error for validation errors", () => {
  assert.equal(classifyErrorCode("validation_error"), "validation_error");
  assert.equal(classifyErrorCode("invalid_input"), "validation_error");
  assert.equal(classifyErrorCode("VALIDATION_ERROR"), "validation_error");
});

test("classifyErrorCode returns state_transition_error for state transition errors", () => {
  assert.equal(classifyErrorCode("state_transition_error"), "state_transition_error");
  assert.equal(classifyErrorCode("invalid_state"), "state_transition_error");
  assert.equal(classifyErrorCode("STATE_TRANSITION_ERROR"), "state_transition_error");
});

test("classifyErrorCode returns deadlock_detected for deadlock errors", () => {
  assert.equal(classifyErrorCode("deadlock_detected"), "deadlock_detected");
  assert.equal(classifyErrorCode("DEADLOCK"), "deadlock_detected");
});

test("classifyErrorCode returns data_inconsistency for data inconsistency errors", () => {
  assert.equal(classifyErrorCode("data_inconsistency"), "data_inconsistency");
  assert.equal(classifyErrorCode("data_mismatch"), "data_inconsistency");
  assert.equal(classifyErrorCode("DATA_INCONSISTENCY"), "data_inconsistency");
});

test("classifyErrorCode returns governance_policy_violation for governance errors", () => {
  assert.equal(classifyErrorCode("governance_policy_violation"), "governance_policy_violation");
  assert.equal(classifyErrorCode("governance_error"), "governance_policy_violation");
});

test("classifyErrorCode returns budget_exceeded for budget errors", () => {
  assert.equal(classifyErrorCode("budget_exceeded"), "budget_exceeded");
  assert.equal(classifyErrorCode("cost_exceed"), "budget_exceeded");
  assert.equal(classifyErrorCode("BUDGET_EXCEEDED"), "budget_exceeded");
});

test("classifyErrorCode returns E7 error code as concurrency_limit_exceeded", () => {
  assert.equal(classifyErrorCode("E7"), "concurrency_limit_exceeded");
  assert.equal(classifyErrorCode("E7-001"), "concurrency_limit_exceeded");
  assert.equal(classifyErrorCode("E7_LockTimeout"), "concurrency_limit_exceeded");
});

test("classifyErrorCode returns E8 error code as resource_exhausted", () => {
  assert.equal(classifyErrorCode("E8"), "resource_exhausted");
  assert.equal(classifyErrorCode("E8-001"), "resource_exhausted");
  assert.equal(classifyErrorCode("E8_OutOfMemory"), "resource_exhausted");
});

test("classifyErrorCode returns EC error code as state_transition_error", () => {
  assert.equal(classifyErrorCode("EC"), "state_transition_error");
  assert.equal(classifyErrorCode("EC-001"), "state_transition_error");
  assert.equal(classifyErrorCode("EC_RuntimeError"), "state_transition_error");
});

test("classifyErrorCode returns schema_error for schema errors", () => {
  assert.equal(classifyErrorCode("schema_error"), "schema_error");
  assert.equal(classifyErrorCode("parse_error"), "schema_error");
  assert.equal(classifyErrorCode("SCHEMA_ERROR"), "schema_error");
});

test("classifyErrorCode returns type_error for type errors", () => {
  assert.equal(classifyErrorCode("type_error"), "type_error");
  assert.equal(classifyErrorCode("typeMismatch"), "type_error");
});

test("classifyErrorCode returns unit_test_failure for test failures", () => {
  assert.equal(classifyErrorCode("unit_test_failure"), "unit_test_failure");
  assert.equal(classifyErrorCode("test_fail"), "unit_test_failure");
  assert.equal(classifyErrorCode("test_error"), "unit_test_failure");
});

test("classifyErrorCode returns lint_error for lint errors", () => {
  assert.equal(classifyErrorCode("lint_error"), "lint_error");
  assert.equal(classifyErrorCode("lint_warning"), "lint_error");
});

test("classifyErrorCode returns forbidden_path for forbidden errors", () => {
  assert.equal(classifyErrorCode("forbidden_path"), "forbidden_path");
  assert.equal(classifyErrorCode("access_denied"), "forbidden_path");
});

test("classifyErrorCode returns secret_exposure for secret errors", () => {
  assert.equal(classifyErrorCode("secret_exposure"), "secret_exposure");
  assert.equal(classifyErrorCode("credential_detected"), "secret_exposure");
  assert.equal(classifyErrorCode("api_key_leak"), "secret_exposure");
});

test("classifyErrorCode returns high_risk_operation for high risk errors", () => {
  assert.equal(classifyErrorCode("high_risk_operation"), "high_risk_operation");
  assert.equal(classifyErrorCode("dangerous_operation"), "high_risk_operation");
});

test("classifyErrorCode returns migration_failure for migration errors", () => {
  assert.equal(classifyErrorCode("migration_failure"), "migration_failure");
  assert.equal(classifyErrorCode("schema_migration"), "migration_failure");
});

test("classifyErrorCode returns deployment_failure for deployment errors", () => {
  assert.equal(classifyErrorCode("deployment_failure"), "deployment_failure");
  assert.equal(classifyErrorCode("deploy_error"), "deployment_failure");
  assert.equal(classifyErrorCode("rollback_required"), "deployment_failure");
});

test("classifyErrorCode returns security_policy_violation for security errors", () => {
  assert.equal(classifyErrorCode("security_policy_violation"), "security_policy_violation");
  assert.equal(classifyErrorCode("security_error"), "security_policy_violation");
  assert.equal(classifyErrorCode("policy_violation"), "security_policy_violation");
});

test("classifyErrorCode returns validation_error for unknown codes", () => {
  assert.equal(classifyErrorCode("unknown_code"), "validation_error");
  assert.equal(classifyErrorCode("XYZ123"), "validation_error");
  assert.equal(classifyErrorCode("something_completely_different"), "validation_error");
});

test("classifyFailure adds repairBudgetUsed to classification", () => {
  const result = classifyFailure("unit_test_failure", 2);
  assert.equal(result.category, "unit_test_failure");
  assert.equal(result.repairBudgetUsed, 2);
  assert.equal(result.level, "transient");
  assert.equal(result.legacyLevel, "L1");
});

test("classifyFailure preserves all classification fields", () => {
  const result = classifyFailure("schema_error", 0);
  assert.equal(result.category, "schema_error");
  assert.equal(result.level, "transient");
  assert.equal(result.legacyLevel, "L1");
  assert.equal(result.description, "Output schema mismatch or validation failure");
  assert.equal(result.autoRepairable, true);
  assert.equal(result.requiresModelUpgrade, false);
  assert.equal(result.requiresHumanEscalation, false);
  assert.equal(result.isPlatformException, false);
});

test("classifyFailureFromErrorCode classifies and builds context", () => {
  const result = classifyFailureFromErrorCode("timeout", 1);
  assert.equal(result.category, "timeout_exceeded");
  assert.equal(result.level, "transient");
  assert.equal(result.repairBudgetUsed, 1);
  assert.equal(result.autoRepairable, true);
});

test("classifyFailureFromErrorCode with null returns validation_error", () => {
  const result = classifyFailureFromErrorCode(null, 0);
  assert.equal(result.category, "validation_error");
  assert.equal(result.repairBudgetUsed, 0);
});

test("shouldEscalate returns true for permanent failures regardless of repair budget", () => {
  const failure: FailureContext = {
    category: "forbidden_path",
    level: "permanent",
    legacyLevel: "L3",
    description: "",
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    repairBudgetUsed: 0,
  };
  assert.equal(shouldEscalate(failure, 5), true);
});

test("shouldEscalate returns true for permanent failures with high repair budget", () => {
  const failure: FailureContext = {
    category: "secret_exposure",
    level: "permanent",
    legacyLevel: "L3",
    description: "",
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    repairBudgetUsed: 99,
  };
  assert.equal(shouldEscalate(failure, 100), true);
});

test("shouldEscalate returns true for unknown failures after one repair", () => {
  const failure: FailureContext = {
    category: "complex_repair_failure",
    level: "unknown",
    legacyLevel: "L2",
    description: "",
    autoRepairable: false,
    requiresModelUpgrade: true,
    requiresHumanEscalation: false,
    repairBudgetUsed: 1,
  };
  assert.equal(shouldEscalate(failure, 5), true);
});

test("shouldEscalate returns false for unknown failures before repair", () => {
  const failure: FailureContext = {
    category: "planning_inconsistency",
    level: "unknown",
    legacyLevel: "L2",
    description: "",
    autoRepairable: false,
    requiresModelUpgrade: true,
    requiresHumanEscalation: false,
    repairBudgetUsed: 0,
  };
  assert.equal(shouldEscalate(failure, 5), false);
});

test("shouldEscalate returns true when repair budget exhausted", () => {
  const failure: FailureContext = {
    category: "schema_error",
    level: "transient",
    legacyLevel: "L1",
    description: "",
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    repairBudgetUsed: 3,
  };
  assert.equal(shouldEscalate(failure, 3), true);
});

test("shouldEscalate returns false when transient failures have budget remaining", () => {
  const failure: FailureContext = {
    category: "type_error",
    level: "transient",
    legacyLevel: "L1",
    description: "",
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    repairBudgetUsed: 2,
  };
  assert.equal(shouldEscalate(failure, 5), false);
});

test("FAILURE_CLASSIFICATION has all platform transient categories", () => {
  const platformTransient: FailureCategory[] = [
    "resource_exhausted",
    "timeout_exceeded",
    "dependency_unavailable",
    "quota_exceeded",
    "rate_limit_exceeded",
    "circuit_breaker_open",
    "concurrency_limit_exceeded",
    "validation_error",
    "state_transition_error",
  ];

  for (const category of platformTransient) {
    const classification = FAILURE_CLASSIFICATION[category];
    assert.ok(classification, `Missing classification for ${category}`);
    assert.equal(classification.level, "transient", `${category} should be transient`);
    assert.equal(classification.legacyLevel, "L1", `${category} should preserve legacy L1`);
    assert.equal(classification.autoRepairable, true, `${category} should be autoRepairable`);
    assert.equal(classification.isPlatformException, true, `${category} should be isPlatformException`);
  }
});

test("FAILURE_CLASSIFICATION has all platform permanent categories", () => {
  const platformPermanent: FailureCategory[] = [
    "migration_failure",
    "deadlock_detected",
    "data_inconsistency",
    "governance_policy_violation",
    "budget_exceeded",
    "security_policy_violation",
  ];

  for (const category of platformPermanent) {
    const classification = FAILURE_CLASSIFICATION[category];
    assert.ok(classification, `Missing classification for ${category}`);
    assert.equal(classification.level, "permanent", `${category} should be permanent`);
    assert.equal(classification.legacyLevel, "L3", `${category} should preserve legacy L3`);
    assert.equal(classification.requiresHumanEscalation, true, `${category} should require human escalation`);
    assert.equal(classification.isPlatformException, true, `${category} should be isPlatformException`);
  }
});

test("FAILURE_CLASSIFICATION marks isPlatformException correctly for coding agent categories", () => {
  const codingAgentCategories: FailureCategory[] = [
    "schema_error",
    "type_error",
    "unit_test_failure",
    "lint_error",
    "simple_logic_bug",
    "complex_repair_failure",
    "review_validate_conflict",
    "planning_inconsistency",
    "forbidden_path",
    "secret_exposure",
    "high_risk_operation",
    "deployment_failure",
  ];

  for (const category of codingAgentCategories) {
    const classification = FAILURE_CLASSIFICATION[category];
    assert.equal(classification.isPlatformException, false, `${category} should NOT be isPlatformException`);
  }
});

test("classifyErrorCode normalizes underscores in error codes", () => {
  assert.equal(classifyErrorCode("resource-exhausted"), "resource_exhausted");
  assert.equal(classifyErrorCode("resource.exhausted"), "resource_exhausted");
  assert.equal(classifyErrorCode("resourceExhausted"), "resource_exhausted");
});

test("classifyErrorCode normalizes dashes in error codes", () => {
  assert.equal(classifyErrorCode("time-out"), "timeout_exceeded");
  assert.equal(classifyErrorCode("time_out"), "timeout_exceeded");
});

test("classifyErrorCode normalizes dots in error codes", () => {
  assert.equal(classifyErrorCode("dead.lock"), "deadlock_detected");
});

test("all FailureCategory values are in FAILURE_CLASSIFICATION", () => {
  const allCategories: FailureCategory[] = [
    "resource_exhausted",
    "timeout_exceeded",
    "dependency_unavailable",
    "quota_exceeded",
    "rate_limit_exceeded",
    "circuit_breaker_open",
    "concurrency_limit_exceeded",
    "validation_error",
    "state_transition_error",
    "schema_error",
    "type_error",
    "unit_test_failure",
    "lint_error",
    "simple_logic_bug",
    "complex_repair_failure",
    "review_validate_conflict",
    "planning_inconsistency",
    "forbidden_path",
    "secret_exposure",
    "high_risk_operation",
    "migration_failure",
    "deployment_failure",
    "security_policy_violation",
    "deadlock_detected",
    "data_inconsistency",
    "governance_policy_violation",
    "budget_exceeded",
  ];

  for (const category of allCategories) {
    assert.ok(
      category in FAILURE_CLASSIFICATION,
      `Category ${category} is missing from FAILURE_CLASSIFICATION`,
    );
  }
});
