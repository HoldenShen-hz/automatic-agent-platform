import assert from "node:assert/strict";
import test from "node:test";

import { DeploymentInventoryService } from "../../../../../src/platform/shared/stability/deployment-inventory-service.js";

test("DeploymentInventoryService reports deployment readiness and contract-only coverage", () => {
  const service = new DeploymentInventoryService();
  const records = service.listDeployments();
  const summary = service.buildSummary();

  assert.equal(records.length, 4);
  assert.equal(records.every((record) => record.s4Mode === "contract_only"), true);
  assert.equal(summary.ready, 2);
  assert.equal(summary.conditional, 2);
  assert.equal(summary.contractOnly, 4);
});
