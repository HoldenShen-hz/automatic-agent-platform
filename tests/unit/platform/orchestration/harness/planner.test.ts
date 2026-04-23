import test from "node:test";
import assert from "node:assert/strict";
import { EvalRunService } from "../../../../../src/platform/orchestration/harness/index.js";
import { TaskOutcomeGrader } from "../../../../../src/platform/orchestration/harness/index.js";

test("EvalRunService is exported from harness index", () => {
  const service = new EvalRunService();
  assert.ok(service !== undefined);
  assert.equal(typeof service.evaluate, "function");
});

test("TaskOutcomeGrader is exported from harness index", () => {
  const grader = new TaskOutcomeGrader();
  assert.ok(grader !== undefined);
  assert.equal(typeof grader.grade, "function");
});
