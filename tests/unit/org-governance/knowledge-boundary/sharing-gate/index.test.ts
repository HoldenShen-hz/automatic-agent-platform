import assert from "node:assert/strict";
import test from "node:test";

import {
  KnowledgeShareGrantSchema,
  evaluateKnowledgeShare,
} from "../../../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";

test("KnowledgeShareGrantSchema validates correct grant", () => {
  const valid = {
    grantId: "grant_123",
    boundaryId: "boundary_456",
    requesterOrgNodeId: "node_789",
    purpose: "collaboration",
    expiresAt: "2026-04-14T12:00:00.000Z",
  };
  const result = KnowledgeShareGrantSchema.parse(valid);
  assert.equal(result.grantId, "grant_123");
  assert.equal(result.boundaryId, "boundary_456");
  assert.equal(result.requesterOrgNodeId, "node_789");
  assert.equal(result.purpose, "collaboration");
  assert.equal(result.expiresAt, "2026-04-14T12:00:00.000Z");
});

test("KnowledgeShareGrantSchema rejects empty grantId", () => {
  assert.throws(() => {
    KnowledgeShareGrantSchema.parse({
      grantId: "",
      boundaryId: "boundary_456",
      requesterOrgNodeId: "node_789",
      purpose: "collaboration",
      expiresAt: "2026-04-14T12:00:00.000Z",
    });
  });
});

test("evaluateKnowledgeShare returns true when requester is owner", () => {
  const boundary = {
    boundaryId: "boundary_1",
    ownerOrgNodeId: "node_owner",
    allowedOrgNodeIds: [],
    isExternal: false,
  };
  const result = evaluateKnowledgeShare(boundary, "node_owner", [], "2026-04-14T12:00:00.000Z");
  assert.equal(result.allowed, true);
});

test("evaluateKnowledgeShare returns true when requester is in allowed list", () => {
  const boundary = {
    boundaryId: "boundary_1",
    ownerOrgNodeId: "node_owner",
    allowedOrgNodeIds: ["node_allowed_1", "node_allowed_2"],
    isExternal: false,
  };
  const result = evaluateKnowledgeShare(boundary, "node_allowed_1", [], "2026-04-14T12:00:00.000Z");
  assert.equal(result.allowed, true);
});

test("evaluateKnowledgeShare returns false when requester is not authorized", () => {
  const boundary = {
    boundaryId: "boundary_1",
    ownerOrgNodeId: "node_owner",
    allowedOrgNodeIds: [],
    isExternal: false,
  };
  const result = evaluateKnowledgeShare(boundary, "node_unauthorized", [], "2026-04-14T12:00:00.000Z");
  assert.equal(result.allowed, false);
});

test("evaluateKnowledgeShare returns true when grant has no expiry (undefined)", () => {
  const boundary = {
    boundaryId: "boundary_1",
    ownerOrgNodeId: "node_owner",
    allowedOrgNodeIds: [],
    isExternal: false,
  };
  const grants = [
    {
      grantId: "grant_1",
      boundaryId: "boundary_1",
      requesterOrgNodeId: "node_requester",
      purpose: "research",
    },
  ];
  const result = evaluateKnowledgeShare(boundary, "node_requester", grants, "2026-04-14T12:00:00.000Z");
  assert.equal(result.allowed, true);
  assert.equal(result.matchedGrantId, "grant_1");
});

test("evaluateKnowledgeShare returns true when grant has null expiry", () => {
  const boundary = {
    boundaryId: "boundary_1",
    ownerOrgNodeId: "node_owner",
    allowedOrgNodeIds: [],
    isExternal: false,
  };
  const grants = [
    {
      grantId: "grant_1",
      boundaryId: "boundary_1",
      requesterOrgNodeId: "node_requester",
      purpose: "research",
      expiresAt: null,
    },
  ];
  const result = evaluateKnowledgeShare(boundary, "node_requester", grants, "2026-04-14T12:00:00.000Z");
  assert.equal(result.allowed, true);
  assert.equal(result.matchedGrantId, "grant_1");
});

test("evaluateKnowledgeShare returns false when grant has invalid date string for expiresAt", () => {
  const boundary = {
    boundaryId: "boundary_1",
    ownerOrgNodeId: "node_owner",
    allowedOrgNodeIds: [],
    isExternal: false,
  };
  const grants = [
    {
      grantId: "grant_1",
      boundaryId: "boundary_1",
      requesterOrgNodeId: "node_requester",
      purpose: "research",
      expiresAt: "not-a-valid-date",
    },
  ];
  const result = evaluateKnowledgeShare(boundary, "node_requester", grants, "2026-04-14T12:00:00.000Z");
  assert.equal(result.allowed, false);
  assert.equal(result.matchedGrantId, null);
});

test("evaluateKnowledgeShare returns true when grant is valid and not expired", () => {
  const boundary = {
    boundaryId: "boundary_1",
    ownerOrgNodeId: "node_owner",
    allowedOrgNodeIds: [],
    isExternal: false,
  };
  const grants = [
    {
      grantId: "grant_1",
      boundaryId: "boundary_1",
      requesterOrgNodeId: "node_requester",
      purpose: "research",
      expiresAt: "2026-04-20T00:00:00.000Z",
    },
  ];
  const result = evaluateKnowledgeShare(boundary, "node_requester", grants, "2026-04-14T12:00:00.000Z");
  assert.equal(result.allowed, true);
});

test("evaluateKnowledgeShare returns false when grant is expired", () => {
  const boundary = {
    boundaryId: "boundary_1",
    ownerOrgNodeId: "node_owner",
    allowedOrgNodeIds: [],
    isExternal: false,
  };
  const grants = [
    {
      grantId: "grant_1",
      boundaryId: "boundary_1",
      requesterOrgNodeId: "node_requester",
      purpose: "research",
      expiresAt: "2026-04-10T00:00:00.000Z",
    },
  ];
  const result = evaluateKnowledgeShare(boundary, "node_requester", grants, "2026-04-14T12:00:00.000Z");
  assert.equal(result.allowed, false);
});

test("evaluateKnowledgeShare returns false when grant is for different boundary", () => {
  const boundary = {
    boundaryId: "boundary_1",
    ownerOrgNodeId: "node_owner",
    allowedOrgNodeIds: [],
    isExternal: false,
  };
  const grants = [
    {
      grantId: "grant_1",
      boundaryId: "boundary_2",
      requesterOrgNodeId: "node_requester",
      purpose: "research",
      expiresAt: "2026-04-20T00:00:00.000Z",
    },
  ];
  const result = evaluateKnowledgeShare(boundary, "node_requester", grants, "2026-04-14T12:00:00.000Z");
  assert.equal(result.allowed, false);
});

test("evaluateKnowledgeShare returns false when grant is for different requester", () => {
  const boundary = {
    boundaryId: "boundary_1",
    ownerOrgNodeId: "node_owner",
    allowedOrgNodeIds: [],
    isExternal: false,
  };
  const grants = [
    {
      grantId: "grant_1",
      boundaryId: "boundary_1",
      requesterOrgNodeId: "node_other",
      purpose: "research",
      expiresAt: "2026-04-20T00:00:00.000Z",
    },
  ];
  const result = evaluateKnowledgeShare(boundary, "node_requester", grants, "2026-04-14T12:00:00.000Z");
  assert.equal(result.allowed, false);
});

test("evaluateKnowledgeShare returns false when grants array is empty", () => {
  const boundary = {
    boundaryId: "boundary_1",
    ownerOrgNodeId: "node_owner",
    allowedOrgNodeIds: [],
    isExternal: false,
  };
  const result = evaluateKnowledgeShare(boundary, "node_unauthorized", [], "2026-04-14T12:00:00.000Z");
  assert.equal(result.allowed, false);
});
