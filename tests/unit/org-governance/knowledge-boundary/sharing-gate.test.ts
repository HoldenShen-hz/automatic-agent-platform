import assert from "node:assert/strict";
import test from "node:test";

import { evaluateKnowledgeShare, KnowledgeShareGrantSchema } from "../../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";
import type { KnowledgeBoundary } from "../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";

function createBoundary(boundaryId: string, ownerOrgNodeId: string, allowedOrgNodeIds: string[] = []): KnowledgeBoundary {
  return {
    boundaryId,
    ownerOrgNodeId,
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds,
  };
}

// R1-10 / R4-46: Tenant isolation in sharing gate - owner access bypasses tenant check
test("evaluateKnowledgeShare returns transform result for owner org node", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const result = evaluateKnowledgeShare(boundary, "dept_finance", [], "2026-04-20T00:00:00.000Z");

  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.mode, "summary");
});

test("evaluateKnowledgeShare returns transform result for allowed org node", () => {
  const boundary = createBoundary("kb_finance", "dept_finance", ["dept_audit", "dept_compliance"]);

  const result = evaluateKnowledgeShare(boundary, "dept_audit", [], "2026-04-20T00:00:00.000Z");

  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.mode, "summary");
});

test("evaluateKnowledgeShare returns null for unauthorized org node without grant", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const result = evaluateKnowledgeShare(boundary, "dept_hr", [], "2026-04-20T00:00:00.000Z");

  assert.strictEqual(result, null);
});

test("evaluateKnowledgeShare returns transform result when valid grant exists", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [{
    grantId: "grant_1",
    boundaryId: "kb_finance",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
  }];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.mode, "summary");
});

test("evaluateKnowledgeShare returns null when grant is expired", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [{
    grantId: "grant_1",
    boundaryId: "kb_finance",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-15T00:00:00.000Z", // expired
  }];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.strictEqual(result, null);
});

test("evaluateKnowledgeShare returns null when grant boundaryId does not match", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [{
    grantId: "grant_1",
    boundaryId: "kb_legal", // different boundary
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
  }];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.strictEqual(result, null);
});

test("evaluateKnowledgeShare returns null when grant requesterOrgNodeId does not match", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [{
    grantId: "grant_1",
    boundaryId: "kb_finance",
    requesterOrgNodeId: "dept_legal", // different org node
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
  }];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.strictEqual(result, null);
});

test("evaluateKnowledgeShare returns field_filter mode from grant when specified", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [{
    grantId: "grant_field",
    boundaryId: "kb_finance",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
    transformMode: "field_filter" as const,
    allowedFieldKeys: ["field_a", "field_b"],
  }];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.mode, "field_filter");
  assert.deepStrictEqual(result?.allowedFieldKeys, ["field_a", "field_b"]);
});

test("evaluateKnowledgeShare defaults to summary mode when grant has no transformMode", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [{
    grantId: "grant_no_mode",
    boundaryId: "kb_finance",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
    // no transformMode
  }];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.mode, "summary");
  assert.strictEqual(result?.allowedFieldKeys, undefined);
});

test("evaluateKnowledgeShare respects null vs undefined expiresAt", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  // Grant with no expiresAt (null/undefined) should be valid
  const grants = [{
    grantId: "grant_no_expiry",
    boundaryId: "kb_finance",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "", // empty string - treated as no expiry per code
  }];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.notStrictEqual(result, null);
});

test("evaluateKnowledgeShare allows multiple grants, returns first matching", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [
    {
      grantId: "grant_1",
      boundaryId: "kb_legal", // doesn't match
      requesterOrgNodeId: "dept_hr",
      purpose: "audit",
      expiresAt: "2026-04-25T00:00:00.000Z",
    },
    {
      grantId: "grant_2",
      boundaryId: "kb_finance", // matches
      requesterOrgNodeId: "dept_hr",
      purpose: "audit",
      expiresAt: "2026-04-25T00:00:00.000Z",
      transformMode: "field_filter" as const,
      allowedFieldKeys: ["secret"],
    },
  ];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.mode, "field_filter");
});

test("KnowledgeShareGrantSchema validates correct grant", () => {
  const validGrant = {
    grantId: "grant_valid",
    boundaryId: "kb_test",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
  };

  const result = KnowledgeShareGrantSchema.safeParse(validGrant);
  assert.strictEqual(result.success, true);
});

test("KnowledgeShareGrantSchema rejects empty grantId", () => {
  const invalidGrant = {
    grantId: "",
    boundaryId: "kb_test",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
  };

  const result = KnowledgeShareGrantSchema.safeParse(invalidGrant);
  assert.strictEqual(result.success, false);
});

test("KnowledgeShareGrantSchema rejects empty boundaryId", () => {
  const invalidGrant = {
    grantId: "grant_1",
    boundaryId: "",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
  };

  const result = KnowledgeShareGrantSchema.safeParse(invalidGrant);
  assert.strictEqual(result.success, false);
});

test("KnowledgeShareGrantSchema accepts valid transformMode enum values", () => {
  const grantSummary = {
    grantId: "grant_1",
    boundaryId: "kb_test",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
    transformMode: "summary" as const,
  };

  const grantField = {
    grantId: "grant_2",
    boundaryId: "kb_test",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
    transformMode: "field_filter" as const,
  };

  assert.strictEqual(KnowledgeShareGrantSchema.safeParse(grantSummary).success, true);
  assert.strictEqual(KnowledgeShareGrantSchema.safeParse(grantField).success, true);
});

test("KnowledgeShareGrantSchema rejects invalid transformMode", () => {
  const invalidGrant = {
    grantId: "grant_1",
    boundaryId: "kb_test",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
    transformMode: "invalid_mode",
  };

  const result = KnowledgeShareGrantSchema.safeParse(invalidGrant);
  assert.strictEqual(result.success, false);
});

test("KnowledgeShareGrantSchema accepts optional allowedFieldKeys array", () => {
  const grantWithFields = {
    grantId: "grant_1",
    boundaryId: "kb_test",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-04-25T00:00:00.000Z",
    transformMode: "field_filter" as const,
    allowedFieldKeys: ["field_a", "field_b", "field_c"],
  };

  const result = KnowledgeShareGrantSchema.safeParse(grantWithFields);
  assert.strictEqual(result.success, true);
});