import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { NoGoPolicyRegistry } from "../../../../../src/platform/five-plane-control-plane/iam/no-go-policy-registry.js";

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

test("NoGoPolicyRegistry lists global and family actions and filters by surface/block mode", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-no-go-registry-"));
  const policyRoot = join(workspace, "config", "policy");

  try {
    writeFile(join(policyRoot, "no-go-actions.yaml"), [
      "globalActions:",
      "  - id: no-auto-payment",
      "    description: \"No automated payment\"",
      "    riskClass: R5",
      "    scopes: [finance]",
      "    enforcementSurfaces: [ReleaseGate]",
      "    blockModes: [autonomous_execution]",
      "familyActions:",
      "  - familyId: regulated",
      "    actions:",
      "      - id: regulated-no-autonomous-high-impact-action",
      "        description: \"No autonomy\"",
      "        riskClass: R5",
      "        scopes: [legal]",
      "        enforcementSurfaces: [ToolRisk, ReleaseGate]",
      "        blockModes: [autonomous_final_decision, unrestricted_model_routing]",
    ].join("\n"));

    const registry = new NoGoPolicyRegistry({ platformRoot: workspace, policyRoot });
    assert.equal(registry.listActions().length, 2);
    assert.equal(registry.findMatchingActions({
      familyId: "regulated",
      enforcementSurface: "ToolRisk",
      blockMode: "autonomous_final_decision",
    }).length, 1);
    assert.equal(registry.findMatchingActions({
      familyId: "regulated",
      enforcementSurface: "ToolRisk",
      blockMode: "autonomous_external_write",
    }).length, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
