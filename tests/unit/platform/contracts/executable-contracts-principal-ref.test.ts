import assert from "node:assert/strict";
import test from "node:test";

import {
  createPrincipalRef,
} from "../../../../src/platform/contracts/executable-contracts/index.js";

test("createPrincipalRef defaults to the human typed variant", () => {
  const principal = createPrincipalRef({
    principalId: "user_001",
    tenantId: "tenant_001",
    roles: ["operator"],
  });

  assert.equal(principal.type, "human");
  assert.equal(principal.principalId, "user_001");
  assert.deepEqual(principal.roles, ["operator"]);
});

test("createPrincipalRef preserves explicit typed variants", () => {
  const principal = createPrincipalRef({
    principalId: "system_runtime",
    tenantId: "tenant_001",
    type: "system",
    roles: ["runtime"],
    authorizationLevel: "admin",
  });

  assert.equal(principal.type, "system");
  assert.equal(principal.authorizationLevel, "admin");
});
