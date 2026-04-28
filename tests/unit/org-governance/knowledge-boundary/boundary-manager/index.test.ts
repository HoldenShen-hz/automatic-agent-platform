import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessKnowledgeBoundary,
  KnowledgeBoundarySchema,
  resolveKnowledgeAccessPolicy,
  type KnowledgeBoundary,
} from "../../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";

test("KnowledgeBoundarySchema validates valid boundary", () => {
  const valid = {
    boundaryId: "boundary_123",
    ownerOrgNodeId: "org_node_456",
    namespaceIds: ["ns_1", "ns_2"],
    accessPolicy: "strict" as const,
    auditOnAccess: true,
    allowedOrgNodeIds: ["node_a", "node_b"],
  };
  const result = KnowledgeBoundarySchema.parse(valid);
  assert.equal(result.boundaryId, "boundary_123");
  assert.equal(result.ownerOrgNodeId, "org_node_456");
  assert.deepEqual(result.namespaceIds, ["ns_1", "ns_2"]);
  assert.equal(result.accessPolicy, "strict");
  assert.equal(result.auditOnAccess, true);
});

test("KnowledgeBoundarySchema applies defaults", () => {
  const minimal = {
    boundaryId: "boundary_min",
    ownerOrgNodeId: "owner_1",
  };
  const result = KnowledgeBoundarySchema.parse(minimal);
  assert.deepEqual(result.namespaceIds, []);
  assert.equal(result.auditOnAccess, true);
  assert.deepEqual(result.allowedOrgNodeIds, []);
  assert.deepEqual(result.fieldAllowlist, []);
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
    accessPolicy: "strict",
    auditOnAccess: true,
    allowedOrgNodeIds: [],
    fieldAllowlist: [],
  };
  assert.equal(canAccessKnowledgeBoundary(boundary, "owner_1"), true);
});

test("canAccessKnowledgeBoundary returns true when requester is in allowed list", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "owner_1",
    namespaceIds: [],
    accessPolicy: "controlled",
    auditOnAccess: true,
    allowedOrgNodeIds: ["allowed_1", "allowed_2"],
    fieldAllowlist: [],
  };
  assert.equal(canAccessKnowledgeBoundary(boundary, "allowed_1"), true);
  assert.equal(canAccessKnowledgeBoundary(boundary, "allowed_2"), true);
});

test("canAccessKnowledgeBoundary returns false when requester is not authorized", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "owner_1",
    namespaceIds: [],
    accessPolicy: "strict",
    auditOnAccess: true,
    allowedOrgNodeIds: [],
    fieldAllowlist: [],
  };
  assert.equal(canAccessKnowledgeBoundary(boundary, "unauthorized_user"), false);
});

test("resolveKnowledgeAccessPolicy maps legacy public visibility to controlled policy", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "owner_1",
    namespaceIds: [],
    defaultVisibility: "public",
    allowedOrgNodeIds: [],
    auditOnAccess: true,
    fieldAllowlist: [],
  };
  assert.equal(resolveKnowledgeAccessPolicy(boundary), "controlled");
});

test("canAccessKnowledgeBoundary returns true for shared boundary with authorized requester", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "owner_1",
    namespaceIds: [],
    defaultVisibility: "shared",
    allowedOrgNodeIds: ["trusted_user"],
    auditOnAccess: true,
    fieldAllowlist: [],
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
    auditOnAccess: true,
    fieldAllowlist: [],
  };
  assert.equal(canAccessKnowledgeBoundary(boundary, "random_user"), false);
});

test("canAccessKnowledgeBoundary owner takes precedence over allowed list", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "b1",
    ownerOrgNodeId: "special_owner",
    namespaceIds: [],
    accessPolicy: "strict",
    auditOnAccess: true,
    allowedOrgNodeIds: ["allowed_user"],
    fieldAllowlist: [],
  };
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
