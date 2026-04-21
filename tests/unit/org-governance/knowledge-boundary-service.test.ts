import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeBoundaryService } from "../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";

test("KnowledgeBoundaryService evaluates access and redacts audit logs", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_finance",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: ["finance_docs"],
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: ["dept_audit"],
  };

  const denied = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_hr",
    "investigate",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(denied.allowed, false);

  const granted = service.evaluateAccess(
    boundary,
    "user_2",
    "dept_hr",
    "audit",
    [{
      grantId: "grant_1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      purpose: "audit",
      expiresAt: "2026-04-21T00:00:00.000Z",
    }],
    undefined,
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(granted.allowed, true);
  assert.ok(service.listRedactedLogs("kb_finance")[0]?.requesterId.startsWith("redacted:"));
});
