import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyFailure,
  classifyPlatformFailure,
  shouldEscalate,
  FAILURE_CLASSIFICATION,
  PLATFORM_FAILURE_CLASSIFICATION,
  type FailureContext,
  type FailureCategory,
  type PlatformFailureCategory,
} from "../../../../../src/platform/execution/recovery/failure-classification.js";

test("FAILURE_CLASSIFICATION contains all categories", () => {
  const categories: FailureCategory[] = [
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
  ];

  for (const category of categories) {
    assert.ok(FAILURE_CLASSIFICATION[category], `Missing classification for ${category}`);
  }
  assert.equal(categories.length, Object.keys(FAILURE_CLASSIFICATION).length);
});

test("classifyFailure returns correct context for L1 category", () => {
  const result = classifyFailure("unit_test_failure", 0);

  assert.equal(result.category, "unit_test_failure");
  assert.equal(result.level, "L1");
  assert.equal(result.autoRepairable, true);
  assert.equal(result.requiresModelUpgrade, false);
  assert.equal(result.requiresHumanEscalation, false);
  assert.equal(result.repairBudgetUsed, 0);
  assert.equal(result.isPlatformException, false); // unit_test_failure is coding-agent specific
  assert.equal(result.surface, "coding_agent");
});

test("classifyFailure returns correct context for schema_error as platform exception", () => {
  const result = classifyFailure("schema_error", 0);

  assert.equal(result.category, "schema_error");
  assert.equal(result.level, "L1");
  assert.equal(result.isPlatformException, true); // Schema validation is a platform capability
  assert.equal(result.surface, "platform");
});

test("classifyFailure returns correct context for L2 category", () => {
  const result = classifyFailure("complex_repair_failure", 1);

  assert.equal(result.category, "complex_repair_failure");
  assert.equal(result.level, "L2");
  assert.equal(result.autoRepairable, false);
  assert.equal(result.requiresModelUpgrade, true);
  assert.equal(result.requiresHumanEscalation, false);
  assert.equal(result.repairBudgetUsed, 1);
});

test("classifyFailure returns correct context for L3 category", () => {
  const result = classifyFailure("secret_exposure", 0);

  assert.equal(result.category, "secret_exposure");
  assert.equal(result.level, "L3");
  assert.equal(result.autoRepairable, false);
  assert.equal(result.requiresModelUpgrade, false);
  assert.equal(result.requiresHumanEscalation, true);
  assert.equal(result.repairBudgetUsed, 0);
});

test("shouldEscalate returns true for L3 failures", () => {
  const l3Failure: FailureContext = {
    category: "forbidden_path",
    level: "L3",
    description: "",
    autoRepairable: false,
    requiresModelUpgrade: false,
    requiresHumanEscalation: true,
    repairBudgetUsed: 0,
    isPlatformException: false,
    surface: "shared",
  };

  assert.equal(shouldEscalate(l3Failure, 3), true);
});

test("shouldEscalate returns true for L2 failures after one repair", () => {
  const l2Failure: FailureContext = {
    category: "complex_repair_failure",
    level: "L2",
    description: "",
    autoRepairable: false,
    requiresModelUpgrade: true,
    requiresHumanEscalation: false,
    repairBudgetUsed: 1,
    isPlatformException: false,
    surface: "shared",
  };

  assert.equal(shouldEscalate(l2Failure, 3), true);
});

test("shouldEscalate returns false for L2 failures before repair", () => {
  const l2Failure: FailureContext = {
    category: "complex_repair_failure",
    level: "L2",
    description: "",
    autoRepairable: false,
    requiresModelUpgrade: true,
    requiresHumanEscalation: false,
    repairBudgetUsed: 0,
    isPlatformException: false,
    surface: "shared",
  };

  assert.equal(shouldEscalate(l2Failure, 3), false);
});

test("shouldEscalate returns true when repair budget exhausted", () => {
  const l1Failure: FailureContext = {
    category: "unit_test_failure",
    level: "L1",
    description: "",
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    repairBudgetUsed: 2,
    isPlatformException: false,
    surface: "coding_agent",
  };

  assert.equal(shouldEscalate(l1Failure, 2), true);
});

test("shouldEscalate returns false when L1 has budget remaining", () => {
  const l1Failure: FailureContext = {
    category: "unit_test_failure",
    level: "L1",
    description: "",
    autoRepairable: true,
    requiresModelUpgrade: false,
    requiresHumanEscalation: false,
    repairBudgetUsed: 1,
    isPlatformException: false,
    surface: "coding_agent",
  };

  assert.equal(shouldEscalate(l1Failure, 3), false);
});

test("L1 categories have autoRepairable true", () => {
  const l1Categories: FailureCategory[] = [
    "schema_error",
    "type_error",
    "unit_test_failure",
    "lint_error",
    "simple_logic_bug",
  ];

  for (const category of l1Categories) {
    const classification = FAILURE_CLASSIFICATION[category];
    assert.equal(classification.level, "L1", `${category} should be L1`);
    assert.equal(classification.autoRepairable, true, `${category} should be autoRepairable`);
  }
});

test("L2 categories require model upgrade", () => {
  const l2Categories: FailureCategory[] = [
    "complex_repair_failure",
    "review_validate_conflict",
    "planning_inconsistency",
  ];

  for (const category of l2Categories) {
    const classification = FAILURE_CLASSIFICATION[category];
    assert.equal(classification.level, "L2", `${category} should be L2`);
    assert.equal(classification.requiresModelUpgrade, true, `${category} should require model upgrade`);
  }
});

test("L3 categories require human escalation", () => {
  const l3Categories: FailureCategory[] = [
    "forbidden_path",
    "secret_exposure",
    "high_risk_operation",
    "migration_failure",
    "deployment_failure",
    "security_policy_violation",
  ];

  for (const category of l3Categories) {
    const classification = FAILURE_CLASSIFICATION[category];
    assert.equal(classification.level, "L3", `${category} should be L3`);
    assert.equal(classification.requiresHumanEscalation, true, `${category} should require human escalation`);
  }
});

// R8-14: schema_error and type_error are platform exceptions, not coding-agent specific
test("schema_error and type_error are platform exceptions per §9.6", () => {
  assert.equal(FAILURE_CLASSIFICATION.schema_error.isPlatformException, true, "schema_error should be a platform exception");
  assert.equal(FAILURE_CLASSIFICATION.type_error.isPlatformException, true, "type_error should be a platform exception");
});

test("lint_error and unit_test_failure are NOT platform exceptions (coding-agent specific)", () => {
  assert.equal(FAILURE_CLASSIFICATION.lint_error.isPlatformException, false, "lint_error should NOT be a platform exception");
  assert.equal(FAILURE_CLASSIFICATION.unit_test_failure.isPlatformException, false, "unit_test_failure should NOT be a platform exception");
});

test("all categories have isPlatformException defined", () => {
  const categories: FailureCategory[] = [
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
  ];

  for (const category of categories) {
    const classification = FAILURE_CLASSIFICATION[category];
    assert.ok("isPlatformException" in classification, `${category} should have isPlatformException defined`);
    assert.equal(typeof classification.isPlatformException, "boolean", `${category}.isPlatformException should be a boolean`);
  }
});

test("platform classifier surface excludes coding-agent-only categories", () => {
  const categories = Object.keys(PLATFORM_FAILURE_CLASSIFICATION) as PlatformFailureCategory[];
  assert.ok(!categories.includes("unit_test_failure" as PlatformFailureCategory));
  assert.ok(!categories.includes("lint_error" as PlatformFailureCategory));
  assert.ok(!categories.includes("simple_logic_bug" as PlatformFailureCategory));
});

test("classifyPlatformFailure only returns platform/shared categories", () => {
  const result = classifyPlatformFailure("schema_error", 2);
  assert.equal(result.category, "schema_error");
  assert.equal(result.surface, "platform");
  assert.equal(result.repairBudgetUsed, 2);
});
