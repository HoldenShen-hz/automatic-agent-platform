import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateKnowledgeShare,
  KnowledgeShareGrantSchema,
  type KnowledgeShareGrant,
} from "../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";
import type { KnowledgeBoundary } from "../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";

test("evaluateKnowledgeShare returns summary mode for owner", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_owner",
    namespaceIds: [],
  };

  const result = evaluateKnowledgeShare(boundary, "org_owner", [], "2026-04-20T00:00:00.000Z");

  assert.deepStrictEqual(result, { mode: "summary" });
});

test("evaluateKnowledgeShare returns summary mode for allowed org", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_owner",
    allowedOrgNodeIds: ["org_allowed"],
    namespaceIds: [],
  };

  const result = evaluateKnowledgeShare(boundary, "org_allowed", [], "2026-04-20T00:00:00.000Z");

  assert.deepStrictEqual(result, { mode: "summary" });
});

test("evaluateKnowledgeShare returns null for unauthorized no grant", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_owner",
    namespaceIds: [],
  };

  const result = evaluateKnowledgeShare(boundary, "org_unauthorized", [], "2026-04-20T00:00:00.000Z");

  assert.strictEqual(result, null);
});

test("evaluateKnowledgeShare returns field_filter for valid grant", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_owner",
    namespaceIds: [],
  };
  const grants: KnowledgeShareGrant[] = [
    {
      grantId: "grant_1",
      boundaryId: "kb_1",
      requesterOrgNodeId: "org_requester",
      purpose: "research",
      expiresAt: "2030-01-01T00:00:00.000Z",
      transformMode: "field_filter",
      allowedFieldKeys: ["field_a", "field_b"],
    },
  ];

  const result = evaluateKnowledgeShare(boundary, "org_requester", grants, "2026-04-20T00:00:00.000Z");

  assert.deepStrictEqual(result, { mode: "field_filter", allowedFieldKeys: ["field_a", "field_b"] });
});

test("evaluateKnowledgeShare uses summary default when transformMode not specified", () => {
  const boundary: KnowledgeBoundary = {
    boundaryId: "kb_1",
    ownerOrgNodeId: "org_owner",
    namespaceIds: [],
  };
  const grants: KnowledgeShareGrant[] = [
    {
      grantId: "grant_1",
      boundaryId: "kb_1",
      requesterOrgNodeId: "org_requester",
      purpose: "research",
      expiresAt: "2030-01-01T00:00:00.000Z",
    },
  ];

  const result = evaluateKnowledgeShare(boundary, "org_requester", grants, "2026-04-20T00:00:00.000Z");

  assert.deepStrictEqual(result, { mode: "summary" });
});

test("KnowledgeShareGrantSchema parses valid grant", () => {
  const grant = KnowledgeShareGrantSchema.parse({
    grantId: "grant_1",
    boundaryId: "kb_1",
    requesterOrgNodeId: "org_1",
    purpose: "testing",
    expiresAt: "2030-01-01T00:00:00.000Z",
    transformMode: "field_filter",
    allowedFieldKeys: ["a", "b"],
  });

  assert.strictEqual(grant.grantId, "grant_1");
  assert.strictEqual(grant.transformMode, "field_filter");
});

test("KnowledgeShareGrantSchema rejects missing required fields", () => {
  assert.throws(() => {
    KnowledgeShareGrantSchema.parse({
      grantId: "",
      boundaryId: "kb_1",
      requesterOrgNodeId: "org_1",
      purpose: "test",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
  });
});
