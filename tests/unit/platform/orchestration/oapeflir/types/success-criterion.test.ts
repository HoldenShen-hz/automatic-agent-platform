import test from "node:test";
import assert from "node:assert/strict";

import type { SuccessCriterion } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/types/success-criterion.js";

type SuccessCriterionOverride = Omit<Partial<SuccessCriterion>, "operator"> & {
  operator?: NonNullable<SuccessCriterion["operator"]>;
};

function createSuccessCriterion(overrides: SuccessCriterionOverride = {}): SuccessCriterion {
  const criterion: SuccessCriterion = {
    criterionId: "crit_1",
    description: "Task must complete within timeout",
    validationType: "threshold",
    targetPath: "durationMs",
    expectedValue: 60000,
    operator: "lte",
    required: true,
    severity: "critical",
  };
  if (overrides.criterionId !== undefined) criterion.criterionId = overrides.criterionId;
  if (overrides.description !== undefined) criterion.description = overrides.description;
  if (overrides.validationType !== undefined) criterion.validationType = overrides.validationType;
  if (overrides.targetPath !== undefined) criterion.targetPath = overrides.targetPath;
  if (overrides.expectedValue !== undefined) criterion.expectedValue = overrides.expectedValue;
  if (overrides.operator !== undefined) criterion.operator = overrides.operator;
  if (overrides.required !== undefined) criterion.required = overrides.required;
  if (overrides.severity !== undefined) criterion.severity = overrides.severity;
  if (
    overrides.validationType !== undefined &&
    overrides.validationType !== "threshold" &&
    !Object.prototype.hasOwnProperty.call(overrides, "operator")
  ) {
    delete criterion.operator;
  }
  return criterion;
}

test("SuccessCriterion has all required fields", () => {
  const criterion = createSuccessCriterion();
  assert.equal(criterion.criterionId, "crit_1");
  assert.equal(criterion.description, "Task must complete within timeout");
  assert.equal(criterion.validationType, "threshold");
  assert.equal(criterion.targetPath, "durationMs");
  assert.equal(criterion.expectedValue, 60000);
  assert.equal(criterion.operator, "lte");
  assert.equal(criterion.required, true);
  assert.equal(criterion.severity, "critical");
});

test("SuccessCriterion accepts all validation types", () => {
  const types: SuccessCriterion["validationType"][] = [
    "boolean",
    "threshold",
    "regex_match",
    "output_schema",
    "artifact_exists",
  ];

  for (const validationType of types) {
    const criterion = createSuccessCriterion({ validationType });
    assert.equal(criterion.validationType, validationType);
  }
});

test("SuccessCriterion accepts all operator types", () => {
  const operators: NonNullable<SuccessCriterion["operator"]>[] = [
    "gte",
    "lte",
    "gt",
    "lt",
    "eq",
    "neq",
  ];

  for (const operator of operators) {
    const criterion = createSuccessCriterion({ operator });
    assert.equal(criterion.operator, operator);
  }
});

test("SuccessCriterion accepts all severity levels", () => {
  const severities: SuccessCriterion["severity"][] = ["critical", "warning", "info"];

  for (const severity of severities) {
    const criterion = createSuccessCriterion({ severity });
    assert.equal(criterion.severity, severity);
  }
});

test("SuccessCriterion threshold validation with operator", () => {
  const criterion = createSuccessCriterion({
    validationType: "threshold",
    targetPath: "durationMs",
    expectedValue: 60000,
    operator: "lte",
  });

  assert.equal(criterion.validationType, "threshold");
  assert.equal(criterion.operator, "lte");
  assert.equal(criterion.expectedValue, 60000);
});

test("SuccessCriterion with boolean validation - operator is optional", () => {
  const criterion = createSuccessCriterion({
    validationType: "boolean",
    targetPath: "success",
    expectedValue: true,
  });

  assert.equal(criterion.validationType, "boolean");
  assert.equal(criterion.expectedValue, true);
  // operator should not be set when validationType is boolean (it's optional and omitted)
  assert.equal(criterion.operator, undefined);
});

test("SuccessCriterion with regex_match validation - operator is optional", () => {
  const criterion = createSuccessCriterion({
    validationType: "regex_match",
    targetPath: "output.summary",
    expectedValue: "^Task completed successfully$",
  });

  assert.equal(criterion.validationType, "regex_match");
  assert.equal(criterion.targetPath, "output.summary");
  assert.equal(criterion.operator, undefined);
});

test("SuccessCriterion with output_schema validation - operator is optional", () => {
  const criterion = createSuccessCriterion({
    validationType: "output_schema",
    targetPath: "output.data",
    expectedValue: { type: "object", required: ["id", "name"] },
  });

  assert.equal(criterion.validationType, "output_schema");
  assert.deepEqual(criterion.expectedValue, { type: "object", required: ["id", "name"] });
  assert.equal(criterion.operator, undefined);
});

test("SuccessCriterion with artifact_exists validation - operator is optional", () => {
  const criterion = createSuccessCriterion({
    validationType: "artifact_exists",
    targetPath: "artifacts[0]",
    expectedValue: "artifact:output-1",
  });

  assert.equal(criterion.validationType, "artifact_exists");
  assert.equal(criterion.expectedValue, "artifact:output-1");
  assert.equal(criterion.operator, undefined);
});

test("SuccessCriterion required field controls whether it blocks success", () => {
  const requiredCriterion = createSuccessCriterion({ required: true });
  const optionalCriterion = createSuccessCriterion({ required: false });

  assert.equal(requiredCriterion.required, true);
  assert.equal(optionalCriterion.required, false);
});

test("SuccessCriterion threshold with gte operator", () => {
  const criterion = createSuccessCriterion({
    validationType: "threshold",
    targetPath: "qualityScore",
    expectedValue: 0.8,
    operator: "gte",
  });

  assert.equal(criterion.operator, "gte");
  assert.equal(criterion.expectedValue, 0.8);
});

test("SuccessCriterion threshold with gt operator", () => {
  const criterion = createSuccessCriterion({
    validationType: "threshold",
    targetPath: "tokensUsed",
    expectedValue: 0,
    operator: "gt",
  });

  assert.equal(criterion.operator, "gt");
});

test("SuccessCriterion threshold with lt operator", () => {
  const criterion = createSuccessCriterion({
    validationType: "threshold",
    targetPath: "errorCount",
    expectedValue: 1,
    operator: "lt",
  });

  assert.equal(criterion.operator, "lt");
});

test("SuccessCriterion threshold with eq operator", () => {
  const criterion = createSuccessCriterion({
    validationType: "threshold",
    targetPath: "statusCode",
    expectedValue: 200,
    operator: "eq",
  });

  assert.equal(criterion.operator, "eq");
  assert.equal(criterion.expectedValue, 200);
});

test("SuccessCriterion threshold with neq operator", () => {
  const criterion = createSuccessCriterion({
    validationType: "threshold",
    targetPath: "exitCode",
    expectedValue: 0,
    operator: "neq",
  });

  assert.equal(criterion.operator, "neq");
});

test("SuccessCriterion severity critical blocks execution on failure", () => {
  const criterion = createSuccessCriterion({
    severity: "critical",
    description: "Production deployment requires approval",
  });

  assert.equal(criterion.severity, "critical");
});

test("SuccessCriterion severity warning does not block on failure", () => {
  const criterion = createSuccessCriterion({
    severity: "warning",
    description: "Consider using faster model",
  });

  assert.equal(criterion.severity, "warning");
});

test("SuccessCriterion severity info is informational", () => {
  const criterion = createSuccessCriterion({
    severity: "info",
    description: "Token usage within budget",
  });

  assert.equal(criterion.severity, "info");
});
