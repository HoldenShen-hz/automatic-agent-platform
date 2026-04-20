import assert from "node:assert/strict";
import test from "node:test";

import { createControlDirective, type ControlDirectiveKind } from "../../../../../src/platform/contracts/control-directive/index.js";

test("ControlDirectiveKind accepts the canonical directive kinds", () => {
  const kinds: ControlDirectiveKind[] = ["pause", "resume", "cancel", "rollback", "escalate"];
  assert.equal(kinds.length, 5);
});

test("createControlDirective builds a canonical directive object", () => {
  const directive = createControlDirective({
    kind: "pause",
    targetRef: "execution:1",
    reasonCode: "incident.freeze",
    issuedBy: "operator:1",
    tenantId: "tenant-1",
    executionId: "execution-1",
    metadata: { source: "console" },
  });

  assert.equal(directive.kind, "pause");
  assert.equal(directive.targetRef, "execution:1");
  assert.equal(directive.tenantId, "tenant-1");
});
