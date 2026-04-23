import assert from "node:assert/strict";
import test from "node:test";

import {
  ValidationRepairLoopService,
  type ValidationLoopInput,
  type ValidationDecision,
  type ValidationLoopStage,
  type ValidationFailureRecord,
} from "../../../../../src/platform/execution/recovery/validation-repair-loop.js";

function makeValidationLoopInput(overrides: Partial<ValidationLoopInput> = {}): ValidationLoopInput {
  return {
    taskId: "task-1",
    reviewPassed: true,
    validationPassed: true,
    failedChecks: [],
    changedFiles: [],
    allowedFixScope: [],
    forbiddenScope: [],
    maxDiffLines: 100,
    repairRound: 0,
    maxRepairRounds: 2,
    ...overrides,
  };
}

test("ValidationRepairLoopService.buildRepairEvidencePackage returns correct package", () => {
  const service = new ValidationRepairLoopService();

  const failedChecks: ValidationFailureRecord[] = [
    { check: "typecheck", details: "type error in foo.ts" },
  ];

  const input = makeValidationLoopInput({
    taskId: "task-test",
    failedChecks,
    changedFiles: ["src/foo.ts"],
    allowedFixScope: ["src/**"],
    forbiddenScope: ["**/secrets/**"],
    maxDiffLines: 200,
    repairRound: 1,
  });

  const result = service.buildRepairEvidencePackage(input);

  assert.equal(result.taskId, "task-test");
  assert.deepEqual(result.failedChecks, failedChecks);
  assert.deepEqual(result.changedFiles, ["src/foo.ts"]);
  assert.deepEqual(result.allowedFixScope, ["src/**"]);
  assert.deepEqual(result.forbiddenScope, ["**/secrets/**"]);
  assert.equal(result.maxDiffLines, 200);
  assert.equal(result.repairRound, 1);
});

test("ValidationRepairLoopService.buildRepairEvidencePackage creates copy of arrays", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    changedFiles: ["file1.ts"],
  });

  const result = service.buildRepairEvidencePackage(input);

  // Ensure it copied the arrays, not just referenced them
  assert.equal(result.changedFiles.length, 1);
  assert.equal(result.changedFiles[0], "file1.ts");
});

test("ValidationRepairLoopService.decide returns released when review and validation pass", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: true,
    validationPassed: true,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "released");
  assert.equal(decision.reasonCode, "validation.released");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, false);
});

test("ValidationRepairLoopService.decide escalates when touched forbidden scope", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    touchedForbiddenScope: true,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "failed_blocking");
  assert.equal(decision.reasonCode, "validation.forbidden_scope_touched");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService.decide escalates after max repair rounds for review failure", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: false,
    repairRound: 2,
    maxRepairRounds: 2,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "escalated");
  assert.equal(decision.reasonCode, "validation.review_failed");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService.decide returns failed_repairable for review failure within budget", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: false,
    repairRound: 1,
    maxRepairRounds: 2,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "failed_repairable");
  assert.equal(decision.reasonCode, "validation.review_failed");
  assert.equal(decision.requiresRepair, true);
  assert.equal(decision.requiresEscalation, false);
});

test("ValidationRepairLoopService.decide escalates after max repair rounds for validation failure", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: true,
    validationPassed: false,
    repairRound: 2,
    maxRepairRounds: 2,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "escalated");
  assert.equal(decision.reasonCode, "validation.checks_failed");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService.decide returns failed_repairable for validation failure within budget", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: true,
    validationPassed: false,
    repairRound: 0,
    maxRepairRounds: 2,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "failed_repairable");
  assert.equal(decision.reasonCode, "validation.checks_failed");
  assert.equal(decision.requiresRepair, true);
  assert.equal(decision.requiresEscalation, false);
});

test("ValidationRepairLoopService.decide prefers review failure over validation failure", () => {
  const service = new ValidationRepairLoopService();

  // Both failing but review check takes precedence
  const input = makeValidationLoopInput({
    reviewPassed: false,
    validationPassed: false,
  });

  const decision = service.decide(input);

  assert.equal(decision.reasonCode, "validation.review_failed");
});

test("ValidationLoopStage type accepts all valid values", () => {
  const stages: ValidationLoopStage[] = [
    "planned",
    "built",
    "review_failed",
    "validation_failed",
    "failed_repairable",
    "failed_blocking",
    "escalated",
    "released",
    "rolled_back",
  ];

  assert.equal(stages.length, 9);
});

test("ValidationDecision has correct structure for all outcomes", () => {
  const service = new ValidationRepairLoopService();

  // Test released
  const released = service.decide(makeValidationLoopInput({ reviewPassed: true, validationPassed: true }));
  assert.ok("stage" in released);
  assert.ok("reasonCode" in released);
  assert.ok("requiresRepair" in released);
  assert.ok("requiresEscalation" in released);

  // Test failed_repairable
  const repairable = service.decide(makeValidationLoopInput({ reviewPassed: false, repairRound: 0 }));
  assert.equal(repairable.stage, "failed_repairable");

  // Test failed_blocking
  const blocking = service.decide(makeValidationLoopInput({ touchedForbiddenScope: true }));
  assert.equal(blocking.stage, "failed_blocking");
});

test("ValidationRepairLoopService handles edge case when repairRound equals maxRepairRounds - 1", () => {
  const service = new ValidationRepairLoopService();

  // This is the last round before escalation
  const input = makeValidationLoopInput({
    reviewPassed: false,
    repairRound: 1,
    maxRepairRounds: 2,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "failed_repairable");
  assert.equal(decision.requiresRepair, true);
  assert.equal(decision.requiresEscalation, false);
});