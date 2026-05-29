import assert from "node:assert/strict";
import test from "node:test";

import {
  listRiskRegisterRecords,
  RiskRegister,
} from "../../src/platform/architecture/risk-register.js";

test("RiskRegister turns architecture risk catalog into release-gate records", () => {
  const registry = new RiskRegister();
  const risks = registry.list();

  assert.deepEqual(
    risks.map((risk) => risk.riskId),
    [
      "RISK-GRAPH-001",
      "RISK-SIDEEFFECT-001",
      "RISK-BUDGET-001",
      "RISK-DOMAIN-001",
      "RISK-RECOVERY-001",
      "RISK-WEB-001",
    ],
  );
  registry.assertReleaseGateReady();
  assert.equal(listRiskRegisterRecords().length, risks.length);
});

test("RiskRegister links risks to invariants and tests", () => {
  const registry = new RiskRegister();
  const domainRisk = registry.resolve("RISK-DOMAIN-001");

  assert.equal(domainRisk.linkedInvariant, "INV-DOMAIN-001");
  assert.equal(domainRisk.status, "mitigated");
  assert.match(domainRisk.linkedTest, /domain-spec-coverage/);
});
