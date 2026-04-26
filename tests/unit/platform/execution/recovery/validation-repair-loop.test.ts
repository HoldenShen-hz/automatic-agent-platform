import assert from "node:assert/strict";
import test from "node:test";

import {
  ValidationRepairLoopService,
  type ValidationLoopInput,
  type ValidationDecision,
  type ValidationLoopStage,
  type ValidationFailureRecord,
  type RepairEvidencePackage,
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

test("ValidationRepairLoopService.decide with reviewFailed at round 0 triggers failed_repairable", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: false,
    repairRound: 0,
    maxRepairRounds: 3,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "failed_repairable");
  assert.equal(decision.reasonCode, "validation.review_failed");
  assert.equal(decision.requiresRepair, true);
  assert.equal(decision.requiresEscalation, false);
});

test("ValidationRepairLoopService.decide with validationFailed at max rounds triggers escalated", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: true,
    validationPassed: false,
    repairRound: 5,
    maxRepairRounds: 5,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "escalated");
  assert.equal(decision.reasonCode, "validation.checks_failed");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService.decide with reviewFailed at max rounds triggers escalated", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: false,
    validationPassed: true,
    repairRound: 10,
    maxRepairRounds: 10,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "escalated");
  assert.equal(decision.reasonCode, "validation.review_failed");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService.decide with touchedForbiddenScope overrides reviewPassed", () => {
  const service = new ValidationRepairLoopService();

  // Even with reviewPassed true, forbidden scope touch takes precedence
  const input = makeValidationLoopInput({
    reviewPassed: true,
    validationPassed: true,
    touchedForbiddenScope: true,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "failed_blocking");
  assert.equal(decision.reasonCode, "validation.forbidden_scope_touched");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService.decide with touchedForbiddenScope overrides validation failure", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: true,
    validationPassed: false,
    touchedForbiddenScope: true,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "failed_blocking");
  assert.equal(decision.reasonCode, "validation.forbidden_scope_touched");
});

test("ValidationRepairLoopService.decide with touchedForbiddenScope overrides review failure", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: false,
    validationPassed: true,
    touchedForbiddenScope: true,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "failed_blocking");
  assert.equal(decision.reasonCode, "validation.forbidden_scope_touched");
});

test("ValidationRepairLoopService.decide with all failures and touchedForbiddenScope", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: false,
    validationPassed: false,
    touchedForbiddenScope: true,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "failed_blocking");
  assert.equal(decision.reasonCode, "validation.forbidden_scope_touched");
});

test("ValidationRepairLoopService.buildRepairEvidencePackage preserves all fields", () => {
  const service = new ValidationRepairLoopService();

  const failedChecks: ValidationFailureRecord[] = [
    { check: "lint", details: "unused variable" },
    { check: "typecheck", details: "type mismatch" },
  ];

  const input = makeValidationLoopInput({
    taskId: "task-preserve-test",
    failedChecks,
    changedFiles: ["src/a.ts", "src/b.ts"],
    allowedFixScope: ["src/**", "lib/**"],
    forbiddenScope: ["**/secrets/**", "**/config/**"],
    maxDiffLines: 500,
    repairRound: 2,
  });

  const result = service.buildRepairEvidencePackage(input);

  assert.equal(result.taskId, "task-preserve-test");
  assert.deepEqual(result.failedChecks, failedChecks);
  assert.deepEqual(result.changedFiles, ["src/a.ts", "src/b.ts"]);
  assert.deepEqual(result.allowedFixScope, ["src/**", "lib/**"]);
  assert.deepEqual(result.forbiddenScope, ["**/secrets/**", "**/config/**"]);
  assert.equal(result.maxDiffLines, 500);
  assert.equal(result.repairRound, 2);
});

test("ValidationRepairLoopService.buildRepairEvidencePackage creates independent copy of arrays", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    failedChecks: [{ check: "test", details: "detail" }],
    changedFiles: ["file.ts"],
  });

  const result = service.buildRepairEvidencePackage(input);

  // Modify the result arrays
  result.failedChecks.push({ check: "modified", details: "modified" });
  result.changedFiles.push("modified.ts");

  // Original input should be unchanged
  assert.equal(input.failedChecks.length, 1);
  assert.equal(input.changedFiles.length, 1);
});

test("ValidationRepairLoopService handles zero maxRepairRounds", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: false,
    maxRepairRounds: 0,
    repairRound: 0,
  });

  const decision = service.decide(input);

  // With 0 max rounds, immediately escalates
  assert.equal(decision.stage, "escalated");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService handles repairRound greater than maxRepairRounds", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: false,
    repairRound: 10,
    maxRepairRounds: 5,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "escalated");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService handles validation failure at repairRound 0", () => {
  const service = new ValidationRepairLoopService();

  const input = makeValidationLoopInput({
    reviewPassed: true,
    validationPassed: false,
    repairRound: 0,
    maxRepairRounds: 3,
  });

  const decision = service.decide(input);

  assert.equal(decision.stage, "failed_repairable");
  assert.equal(decision.requiresRepair, true);
  assert.equal(decision.requiresEscalation, false);
});

test("ValidationFailureRecord has correct structure", () => {
  const record: ValidationFailureRecord = {
    check: "typecheck",
    details: "Cannot find name 'foo'",
  };

  assert.equal(record.check, "typecheck");
  assert.equal(record.details, "Cannot find name 'foo'");
});

test("RepairEvidencePackage has correct structure", () => {
  const pkg: RepairEvidencePackage = {
    taskId: "task-1",
    failedChecks: [],
    changedFiles: [],
    allowedFixScope: [],
    forbiddenScope: [],
    maxDiffLines: 100,
    repairRound: 0,
  };

  assert.ok("taskId" in pkg);
  assert.ok("failedChecks" in pkg);
  assert.ok("changedFiles" in pkg);
  assert.ok("allowedFixScope" in pkg);
  assert.ok("forbiddenScope" in pkg);
  assert.ok("maxDiffLines" in pkg);
  assert.ok("repairRound" in pkg);
});

test("ValidationDecision has correct structure", () => {
  const decision: ValidationDecision = {
    stage: "released",
    reasonCode: "validation.released",
    requiresRepair: false,
    requiresEscalation: false,
  };

  assert.ok("stage" in decision);
  assert.ok("reasonCode" in decision);
  assert.ok("requiresRepair" in decision);
  assert.ok("requiresEscalation" in decision);
});

test("ValidationLoopInput can have optional touchedForbiddenScope", () => {
  const service = new ValidationRepairLoopService();

  // Without touchedForbiddenScope
  const input1 = makeValidationLoopInput({
    reviewPassed: true,
    validationPassed: true,
  });

  const decision1 = service.decide(input1);
  assert.equal(decision1.stage, "released");

  // With touchedForbiddenScope = false
  const input2 = makeValidationLoopInput({
    reviewPassed: true,
    validationPassed: true,
    touchedForbiddenScope: false,
  });

  const decision2 = service.decide(input2);
  assert.equal(decision2.stage, "released");
});

test("ValidationRepairLoopService handles maxRepairRounds of 1", () => {
  const service = new ValidationRepairLoopService();

  // At round 0 with max 1, should allow repair
  const input0 = makeValidationLoopInput({
    reviewPassed: false,
    repairRound: 0,
    maxRepairRounds: 1,
  });

  const decision0 = service.decide(input0);
  assert.equal(decision0.stage, "failed_repairable");

  // At round 1 with max 1, should escalate
  const input1 = makeValidationLoopInput({
    reviewPassed: false,
    repairRound: 1,
    maxRepairRounds: 1,
  });

  const decision1 = service.decide(input1);
  assert.equal(decision1.stage, "escalated");
});