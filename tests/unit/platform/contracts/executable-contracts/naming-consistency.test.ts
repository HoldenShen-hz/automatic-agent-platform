import assert from "node:assert/strict";
import test from "node:test";

import * as executableContracts from "../../../../../src/platform/contracts/executable-contracts/index.js";

test("v4.3 canonical module does not re-export legacy contract entry names", () => {
  const exportedNames = Object.keys(executableContracts);
  const forbiddenExports = [
    "ExecutionPlan",
    "ExecutionReceipt",
    "ControlDirective",
    "StateCommand",
    "StateMutationCommand",
    "createExecutionPlan",
    "createExecutionReceipt",
    "createControlDirective",
    "createStateCommand",
  ];

  for (const forbiddenExport of forbiddenExports) {
    assert.equal(
      exportedNames.includes(forbiddenExport),
      false,
      `${forbiddenExport} must remain legacy/deprecated and outside the v4.3 canonical module`,
    );
  }
});

test("contracts barrel exposes v4.3 only through an explicit namespace", async () => {
  const barrel = await import("../../../../../src/platform/contracts/index.js");

  assert.equal(typeof barrel.executableContracts.createHarnessRun, "function");
  assert.equal(typeof barrel.executableContracts.createPlanGraphBundle, "function");
  assert.equal(typeof barrel.executableContracts.createPlatformFactEvent, "function");
  assert.equal(Object.hasOwn(barrel, "createHarnessRun"), false);
});
