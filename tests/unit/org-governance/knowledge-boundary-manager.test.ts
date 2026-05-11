import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessKnowledgeBoundary,
  resolveKnowledgeAccessPolicy,
  KnowledgeBoundarySchema,
  type KnowledgeBoundary,
} from "../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";

test("canAccessKnowledgeBoundary returns true for owner", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_1",
    namespaceIds: [],
    allowedOrgNodeIds: [],
  };

  assert.strictEqual(canAccessKnowledgeBoundary(boundary, "org_1"), true);
});

test("canAccessKnowledgeBoundary returns true for allowed org node", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_1",
    namespaceIds: [],
    allowedOrgNodeIds: ["org_2", "org_3"],
  };

  assert.strictEqual(canAccessKnowledgeBoundary(boundary, "org_2"), true);
  assert.strictEqual(canAccessKnowledgeBoundary(boundary, "org_3"), true);
});

test("canAccessKnowledgeBoundary returns false for unauthorized org on non-public boundary", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_1",
    namespaceIds: [],
    allowedOrgNodeIds: ["org_2"],
  };

  assert.strictEqual(canAccessKnowledgeBoundary(boundary, "org_999"), false);
});

test("canAccessKnowledgeBoundary returns true for public boundary", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_public",
    ownerOrgNodeId: "org_1",
    namespaceIds: [],
    defaultVisibility: "public",
    allowedOrgNodeIds: [],
  };

  assert.strictEqual(canAccessKnowledgeBoundary(boundary, "org_999"), true);
});

test("resolveKnowledgeAccessPolicy returns strict for private default", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_1",
    namespaceIds: [],
    defaultVisibility: "private",
  };

  assert.strictEqual(resolveKnowledgeAccessPolicy(boundary), "strict");
});

test("resolveKnowledgeAccessPolicy returns controlled for shared default", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_1",
    namespaceIds: [],
    defaultVisibility: "shared",
  };

  assert.strictEqual(resolveKnowledgeAccessPolicy(boundary), "controlled");
});

test("resolveKnowledgeAccessPolicy returns explicit accessPolicy", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_1",
    namespaceIds: [],
    accessPolicy: "controlled",
    defaultVisibility: "private",
  };

  assert.strictEqual(resolveKnowledgeAccessPolicy(boundary), "controlled");
});

test("KnowledgeBoundarySchema parses valid boundary", () => {
  const boundary = KnowledgeBoundarySchema.parse({
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_1",
    namespaceIds: ["ns_1", "ns_2"],
    auditOnAccess: true,
  });

  assert.strictEqual(boundary.boundaryId, "kb_1");
  assert.deepStrictEqual(boundary.namespaceIds, ["ns_1", "ns_2"]);
  assert.strictEqual(boundary.auditOnAccess, true);
});

test("KnowledgeBoundarySchema applies defaults", () => {
  const boundary = KnowledgeBoundarySchema.parse({
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_1",
  });

  assert.deepStrictEqual(boundary.namespaceIds, []);
  assert.deepStrictEqual(boundary.allowedOrgNodeIds, []);
  assert.deepStrictEqual(boundary.fieldAllowlist, []);
  assert.strictEqual(boundary.auditOnAccess, true);
});
