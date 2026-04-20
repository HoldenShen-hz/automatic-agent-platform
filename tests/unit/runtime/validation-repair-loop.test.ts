import test from "node:test";
import assert from "node:assert/strict";

import { ValidationRepairLoopService } from "../../../src/platform/execution/recovery/validation-repair-loop.js";

test("ValidationRepairLoopService releases when review and validation pass", () => {
  const service = new ValidationRepairLoopService();
  const decision = service.decide({
    taskId: "task_1",
    reviewPassed: true,
    validationPassed: true,
    failedChecks: [],
    changedFiles: ["src/a.ts"],
    allowedFixScope: ["src/a.ts"],
    forbiddenScope: ["src/core"],
    maxDiffLines: 80,
    repairRound: 0,
    maxRepairRounds: 2,
  });

  assert.equal(decision.stage, "released");
  assert.equal(decision.requiresRepair, false);
});

test("ValidationRepairLoopService builds repair evidence package and escalates after max rounds", () => {
  const service = new ValidationRepairLoopService();
  const input = {
    taskId: "task_2",
    reviewPassed: false,
    validationPassed: false,
    failedChecks: [{ check: "typecheck", details: "src/a.ts:1 mismatch" }],
    changedFiles: ["src/a.ts"],
    allowedFixScope: ["src/a.ts"],
    forbiddenScope: ["src/core"],
    maxDiffLines: 50,
    repairRound: 2,
    maxRepairRounds: 2,
  } as const;

  const evidence = service.buildRepairEvidencePackage(input);
  const decision = service.decide(input);

  assert.equal(evidence.failedChecks.length, 1);
  assert.equal(decision.stage, "escalated");
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService marks failed_blocking when forbidden scope touched", () => {
  const service = new ValidationRepairLoopService();
  const decision = service.decide({
    taskId: "task_forbidden",
    reviewPassed: true,
    validationPassed: true,
    failedChecks: [],
    changedFiles: ["src/core/secret.ts"],
    allowedFixScope: ["src/a.ts"],
    forbiddenScope: ["src/core"],
    maxDiffLines: 80,
    repairRound: 0,
    maxRepairRounds: 2,
    touchedForbiddenScope: true,
  });

  assert.equal(decision.stage, "failed_blocking");
  assert.equal(decision.reasonCode, "validation.forbidden_scope_touched");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService returns failed_repairable when review fails but repair rounds remain", () => {
  const service = new ValidationRepairLoopService();
  const decision = service.decide({
    taskId: "task_review_fail",
    reviewPassed: false,
    validationPassed: true,
    failedChecks: [{ check: "style", details: "indentation error" }],
    changedFiles: ["src/a.ts"],
    allowedFixScope: ["src/a.ts"],
    forbiddenScope: [],
    maxDiffLines: 80,
    repairRound: 0,
    maxRepairRounds: 2,
  });

  assert.equal(decision.stage, "failed_repairable");
  assert.equal(decision.reasonCode, "validation.review_failed");
  assert.equal(decision.requiresRepair, true);
  assert.equal(decision.requiresEscalation, false);
});

test("ValidationRepairLoopService returns escalated when review fails and no repair rounds remain", () => {
  const service = new ValidationRepairLoopService();
  const decision = service.decide({
    taskId: "task_review_exhausted",
    reviewPassed: false,
    validationPassed: true,
    failedChecks: [],
    changedFiles: ["src/a.ts"],
    allowedFixScope: ["src/a.ts"],
    forbiddenScope: [],
    maxDiffLines: 80,
    repairRound: 2,
    maxRepairRounds: 2,
  });

  assert.equal(decision.stage, "escalated");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService returns failed_repairable when validation fails but repair rounds remain", () => {
  const service = new ValidationRepairLoopService();
  const decision = service.decide({
    taskId: "task_val_fail",
    reviewPassed: true,
    validationPassed: false,
    failedChecks: [{ check: "typecheck", details: "type error" }],
    changedFiles: ["src/a.ts"],
    allowedFixScope: ["src/a.ts"],
    forbiddenScope: [],
    maxDiffLines: 80,
    repairRound: 0,
    maxRepairRounds: 2,
  });

  assert.equal(decision.stage, "failed_repairable");
  assert.equal(decision.reasonCode, "validation.checks_failed");
  assert.equal(decision.requiresRepair, true);
  assert.equal(decision.requiresEscalation, false);
});

test("ValidationRepairLoopService returns escalated when validation fails and no repair rounds remain", () => {
  const service = new ValidationRepairLoopService();
  const decision = service.decide({
    taskId: "task_val_exhausted",
    reviewPassed: true,
    validationPassed: false,
    failedChecks: [{ check: "typecheck", details: "type error" }],
    changedFiles: ["src/a.ts"],
    allowedFixScope: ["src/a.ts"],
    forbiddenScope: [],
    maxDiffLines: 80,
    repairRound: 2,
    maxRepairRounds: 2,
  });

  assert.equal(decision.stage, "escalated");
  assert.equal(decision.requiresRepair, false);
  assert.equal(decision.requiresEscalation, true);
});

test("ValidationRepairLoopService buildRepairEvidencePackage copies input fields", () => {
  const service = new ValidationRepairLoopService();
  const input = {
    taskId: "task_evidence",
    reviewPassed: false,
    validationPassed: false,
    failedChecks: [{ check: "test", details: "failing test" }],
    changedFiles: ["src/b.ts", "src/c.ts"],
    allowedFixScope: ["src/b.ts"],
    forbiddenScope: ["src/core"],
    maxDiffLines: 100,
    repairRound: 1,
    maxRepairRounds: 3,
  };

  const evidence = service.buildRepairEvidencePackage(input);

  assert.equal(evidence.taskId, "task_evidence");
  assert.deepEqual(evidence.failedChecks, [{ check: "test", details: "failing test" }]);
  assert.deepEqual(evidence.changedFiles, ["src/b.ts", "src/c.ts"]);
  assert.deepEqual(evidence.allowedFixScope, ["src/b.ts"]);
  assert.deepEqual(evidence.forbiddenScope, ["src/core"]);
  assert.equal(evidence.maxDiffLines, 100);
  assert.equal(evidence.repairRound, 1);
});
