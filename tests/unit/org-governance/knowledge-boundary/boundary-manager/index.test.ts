import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessKnowledgeBoundary,
  KnowledgeBoundarySchema,
  type KnowledgeBoundary,
} from "../../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";

test("KnowledgeBoundarySchema validates valid boundary", () => {
  const valid = {
    boundaryId: "boundary_123",
    ownerOrgNodeId: "org_node_456",
    namespaceIds: ["ns_1", "ns_2"],
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: ["node_a", "node_b"],
  };
  const result = KnowledgeBoundarySchema.parse(valid);
  assert.equal(result.boundaryId, "boundary_123");
  assert.equal(result.ownerOrgNodeId, "org_node_456");
  assert.deepEqual(result.namespaceIds, ["ns_1", "ns_2"]);
  assert.equal(result.defaultVisibility, "private");
});

test("KnowledgeBoundarySchema applies defaults", () => {
  const minimal = {
    boundaryId: "boundary_min",
    ownerOrgNodeId: "owner_1",
  };
  const result = KnowledgeBoundarySchema.parse(minimal);
  assert.deepEqual(result.namespaceIds, []);
  assert.equal(result.defaultVisibility, "private");
  assert.deepEqual(result.allowedOrgNodeIds, []);
});

test("KnowledgeBoundarySchema rejects invalid visibility", () => {
  assert.throws(() => {
    KnowledgeBoundarySchema.parse({
      boundaryId: "b1",
      ownerOrgNodeId: "o1",
      defaultVisibility: "invalid" as any,
    });
  });
});

test("canAccessKnowledgeBoundary returns true when requester is owner", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "owner_1",
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
  };
  assert.equal(canAccessKnowledgeBoundary(boundary, "owner_1"), true);
});

test("canAccessKnowledgeBoundary returns true when requester is in allowed list", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "owner_1",
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds: ["allowed_1", "allowed_2"],
  };
  assert.equal(canAccessKnowledgeBoundary(boundary, "allowed_1"), true);
  assert.equal(canAccessKnowledgeBoundary(boundary, "allowed_2"), true);
});

test("canAccessKnowledgeBoundary returns false when requester is not authorized", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "owner_1",
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
  };
  assert.equal(canAccessKnowledgeBoundary(boundary, "unauthorized_user"), false);
});

test("canAccessKnowledgeBoundary returns true for public boundary", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "owner_1",
    namespaceIds: [],
    defaultVisibility: "public",
    allowedOrgNodeIds: [],
  };
  assert.equal(canAccessKnowledgeBoundary(boundary, "anyone"), true);
});

test("canAccessKnowledgeBoundary returns true for shared boundary with authorized requester", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "owner_1",
    namespaceIds: [],
    defaultVisibility: "shared",
    allowedOrgNodeIds: ["trusted_user"],
  };
  assert.equal(canAccessKnowledgeBoundary(boundary, "trusted_user"), true);
});

test("canAccessKnowledgeBoundary returns false for shared boundary with unauthorized requester", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "owner_1",
    namespaceIds: [],
    defaultVisibility: "shared",
    allowedOrgNodeIds: ["trusted_user"],
  };
  assert.equal(canAccessKnowledgeBoundary(boundary, "random_user"), false);
});

test("canAccessKnowledgeBoundary owner takes precedence over allowed list", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "special_owner",
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds: ["allowed_user"],
  };
  // Owner should still have access even if they're not in the allowed list
  assert.equal(canAccessKnowledgeBoundary(boundary, "special_owner"), true);
});

test("KnowledgeBoundarySchema rejects empty boundaryId", () => {
  assert.throws(() => {
    KnowledgeBoundarySchema.parse({
      boundaryId: "",
      ownerOrgNodeId: "owner_1",
    });
  });
});

test("KnowledgeBoundarySchema rejects empty ownerOrgNodeId", () => {
  assert.throws(() => {
    KnowledgeBoundarySchema.parse({
      boundaryId: "boundary_1",
      ownerOrgNodeId: "",
    });
  });
});