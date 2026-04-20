import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

interface MockEvalSuite {
  id: string;
  name: string;
  kind: "regression" | "smoke" | "performance" | "integration";
  status: "draft" | "active" | "archived";
  createdAt: string;
  testCount: number;
}

interface MockEvalRun {
  id: string;
  suiteId: string;
  status: "running" | "passed" | "failed" | "aborted";
  startedAt: string;
  completedAt: string | null;
  passedCount: number;
  failedCount: number;
}

test("Eval suite creation with draft status", () => {
  const suite: MockEvalSuite = {
    id: newId("suite"),
    name: "Regression Tests v2",
    kind: "regression",
    status: "draft",
    createdAt: nowIso(),
    testCount: 0,
  };

  assert.ok(suite.id.startsWith("suite_"));
  assert.equal(suite.status, "draft");
  assert.equal(suite.kind, "regression");
});

test("Eval suite transitions to active", () => {
  const suite: MockEvalSuite = {
    id: newId("suite"),
    name: "Smoke Tests",
    kind: "smoke",
    status: "draft",
    createdAt: nowIso(),
    testCount: 10,
  };

  suite.status = "active";

  assert.equal(suite.status, "active");
});

test("Eval suite archived status", () => {
  const suite: MockEvalSuite = {
    id: newId("suite"),
    name: "Old Integration Tests",
    kind: "integration",
    status: "active",
    createdAt: nowIso(),
    testCount: 50,
  };

  suite.status = "archived";

  assert.equal(suite.status, "archived");
});

test("Eval run creation with running status", () => {
  const run: MockEvalRun = {
    id: newId("run"),
    suiteId: newId("suite"),
    status: "running",
    startedAt: nowIso(),
    completedAt: null,
    passedCount: 0,
    failedCount: 0,
  };

  assert.ok(run.id.startsWith("run_"));
  assert.equal(run.status, "running");
  assert.ok(run.completedAt === null);
});

test("Eval run transitions to passed", () => {
  const run: MockEvalRun = {
    id: newId("run"),
    suiteId: newId("suite"),
    status: "running",
    startedAt: nowIso(),
    completedAt: null,
    passedCount: 0,
    failedCount: 0,
  };

  run.passedCount = 10;
  run.failedCount = 0;
  run.status = "passed";
  run.completedAt = nowIso();

  assert.equal(run.status, "passed");
  assert.ok(run.completedAt !== null);
});

test("Eval run with failures", () => {
  const run: MockEvalRun = {
    id: newId("run"),
    suiteId: newId("suite"),
    status: "running",
    startedAt: nowIso(),
    completedAt: null,
    passedCount: 0,
    failedCount: 0,
  };

  run.passedCount = 7;
  run.failedCount = 3;
  run.status = "failed";
  run.completedAt = nowIso();

  assert.equal(run.status, "failed");
  assert.equal(run.passedCount + run.failedCount, 10);
});

test("Eval run aborted", () => {
  const run: MockEvalRun = {
    id: newId("run"),
    suiteId: newId("suite"),
    status: "running",
    startedAt: nowIso(),
    completedAt: null,
    passedCount: 5,
    failedCount: 0,
  };

  run.status = "aborted";
  run.completedAt = nowIso();

  assert.equal(run.status, "aborted");
});

test("Multiple eval suites of different kinds", () => {
  const kinds: MockEvalSuite["kind"][] = ["regression", "smoke", "performance", "integration"];
  const suites: MockEvalSuite[] = [];

  for (const kind of kinds) {
    suites.push({
      id: newId("suite"),
      name: `${kind} tests`,
      kind,
      status: "active",
      createdAt: nowIso(),
      testCount: Math.floor(Math.random() * 100),
    });
  }

  assert.equal(suites.length, 4);
  assert.equal(suites[0]?.kind, "regression");
  assert.equal(suites[3]?.kind, "integration");
});

test("Eval run pass rate calculation", () => {
  const run: MockEvalRun = {
    id: newId("run"),
    suiteId: newId("suite"),
    status: "passed",
    startedAt: nowIso(),
    completedAt: nowIso(),
    passedCount: 45,
    failedCount: 5,
  };

  const total = run.passedCount + run.failedCount;
  const passRate = (run.passedCount / total) * 100;

  assert.equal(passRate, 90);
});
