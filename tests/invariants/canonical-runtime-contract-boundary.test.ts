import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  CANONICAL_CONTRACT_NAMES,
  LEGACY_CONTRACT_NAMES,
} from "../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeEntryGuard } from "../../src/platform/orchestration/harness/runtime/runtime-entry-guard.js";

test("legacy contract directories are compatibility surfaces, not canonical runtime entries", () => {
  const legacyDirectories = ["request-envelope", "execution-plan", "execution-receipt", "control-directive", "state-command"];

  for (const directory of legacyDirectories) {
    assert.equal(existsSync(join(process.cwd(), "src", "platform", "contracts", directory)), true);
  }
  assert.ok(CANONICAL_CONTRACT_NAMES.includes("PlanGraphBundle"));
  assert.ok(CANONICAL_CONTRACT_NAMES.includes("NodeAttemptReceipt"));
  assert.ok(LEGACY_CONTRACT_NAMES.includes("ExecutionPlan"));
  assert.equal(CANONICAL_CONTRACT_NAMES.includes("ExecutionPlan" as never), false);
  assert.equal(CANONICAL_CONTRACT_NAMES.includes("ExecutionReceipt" as never), false);
  assert.equal(CANONICAL_CONTRACT_NAMES.includes("ControlDirective" as never), false);
});

test("runtime truth guard rejects legacy contract names and non-platform events", () => {
  const guard = new RuntimeEntryGuard();

  assert.throws(() => guard.assertNoLegacyTruthWrite({ contractName: "ExecutionPlan" }), /legacy/i);
  assert.throws(() => guard.assertNoLegacyTruthWrite({ contractName: "ExecutionReceipt" }), /legacy/i);
  assert.throws(() => guard.assertNoLegacyTruthWrite({ contractName: "ControlDirective" }), /legacy/i);
  assert.throws(() => guard.assertNoLegacyTruthWrite({ eventType: "oapeflir.view.stage_projected" }), /platform/i);
  assert.doesNotThrow(() => guard.assertNoLegacyTruthWrite({ eventType: "platform.node_run.status_changed" }));
});
