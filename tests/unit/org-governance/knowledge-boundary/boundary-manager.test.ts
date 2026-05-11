import assert from "node:assert/strict";
import test from "node:test";

import { canAccessKnowledgeBoundary, KnowledgeBoundarySchema } from "../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";

test("canAccessKnowledgeBoundary allows public visibility without explicit allowlist", () => {
  const boundary = {
    boundaryId: "kb_public",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    defaultVisibility: "public" as const,
    allowedOrgNodeIds: [],
  };

  const result = canAccessKnowledgeBoundary(boundary, "dept_hr");

  assert.strictEqual(result, true);
});

test("canAccessKnowledgeBoundary returns true for owner org node", () => {
  const boundary = {
    boundaryId: "kb_private",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: [],
  };

  const result = canAccessKnowledgeBoundary(boundary, "dept_finance");

  assert.strictEqual(result, true);
});

test("canAccessKnowledgeBoundary returns true for allowed org node", () => {
  const boundary = {
    boundaryId: "kb_private",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: ["dept_audit", "dept_compliance"],
  };

  const result = canAccessKnowledgeBoundary(boundary, "dept_audit");

  assert.strictEqual(result, true);
});

test("canAccessKnowledgeBoundary returns false for unauthorized org node on private boundary", () => {
  const boundary = {
    boundaryId: "kb_private",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: [],
  };

  const result = canAccessKnowledgeBoundary(boundary, "dept_hr");

  assert.strictEqual(result, false);
});

test("canAccessKnowledgeBoundary returns true for shared visibility with allowed org node", () => {
  const boundary = {
    boundaryId: "kb_shared",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    defaultVisibility: "shared" as const,
    allowedOrgNodeIds: ["dept_hr"],
  };

  const result = canAccessKnowledgeBoundary(boundary, "dept_hr");

  assert.strictEqual(result, true);
});

test("canAccessKnowledgeBoundary returns false for shared visibility without authorization", () => {
  const boundary = {
    boundaryId: "kb_shared",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    defaultVisibility: "shared" as const,
    allowedOrgNodeIds: [],
  };

  const result = canAccessKnowledgeBoundary(boundary, "dept_hr");

  assert.strictEqual(result, false);
});

test("KnowledgeBoundarySchema validates correct boundary", () => {
  const validBoundary = {
    boundaryId: "kb_test",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: ["ns_1"],
    defaultVisibility: "private",
    allowedOrgNodeIds: ["dept_audit"],
  };

  const result = KnowledgeBoundarySchema.safeParse(validBoundary);
  assert.strictEqual(result.success, true);
});

test("KnowledgeBoundarySchema applies defaults", () => {
  const minimalBoundary = {
    boundaryId: "kb_minimal",
    ownerOrgNodeId: "dept_finance",
  };

  const result = KnowledgeBoundarySchema.safeParse(minimalBoundary);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.deepStrictEqual(result.data.namespaceIds, []);
    assert.deepStrictEqual(result.data.allowedOrgNodeIds, []);
    assert.strictEqual(result.data.auditOnAccess, true);
    assert.deepStrictEqual(result.data.fieldAllowlist, []);
  }
});

test("KnowledgeBoundarySchema rejects empty boundaryId", () => {
  const invalidBoundary = {
    boundaryId: "",
    ownerOrgNodeId: "dept_finance",
  };

  const result = KnowledgeBoundarySchema.safeParse(invalidBoundary);
  assert.strictEqual(result.success, false);
});

test("KnowledgeBoundarySchema rejects empty ownerOrgNodeId", () => {
  const invalidBoundary = {
    boundaryId: "kb_test",
    ownerOrgNodeId: "",
  };

  const result = KnowledgeBoundarySchema.safeParse(invalidBoundary);
  assert.strictEqual(result.success, false);
});
