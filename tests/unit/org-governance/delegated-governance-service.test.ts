import assert from "node:assert/strict";
import test from "node:test";

import { DelegatedGovernanceService } from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";

test("DelegatedGovernanceService resolves granted scope for active delegations", () => {
  const service = new DelegatedGovernanceService([
    {
      delegationId: "del_1",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_finance"],
      domainIds: ["finance"],
      capabilities: ["approve_budget"],
      expiresAt: "2026-04-21T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);

  const result = service.resolve("manager", {
    orgNodeId: "dept_finance",
    domainId: "finance",
    capability: "approve_budget",
  }, "2026-04-20T00:00:00.000Z");

  assert.equal(result.allowed, true);
  assert.equal(result.delegationId, "del_1");
});
