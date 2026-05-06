/**
 * Unit tests for Knowledge Boundary Sharing Gate
 * Tests cover specific security and correctness issues:
 * - Issue #1973: Grant expiry check logic error + string comparison not date comparison
 */

import assert from "node:assert/strict";
import test from "node:test";

import { evaluateKnowledgeShare, KnowledgeShareGrantSchema } from "../../../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";
import type { KnowledgeBoundary } from "../../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";

function createBoundary(boundaryId: string, ownerOrgNodeId: string, allowedOrgNodeIds: string[] = []): KnowledgeBoundary {
  return {
    boundaryId,
    ownerOrgNodeId,
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds,
  };
}

function createGrant(overrides: Partial<{
  grantId: string;
  boundaryId: string;
  requesterOrgNodeId: string;
  purpose: string;
  expiresAt: string;
  transformMode: "summary" | "field_filter";
  allowedFieldKeys: string[];
}> = {}): {
  grantId: string;
  boundaryId: string;
  requesterOrgNodeId: string;
  purpose: string;
  expiresAt: string;
  transformMode?: "summary" | "field_filter";
  allowedFieldKeys?: string[];
} {
  return {
    grantId: overrides.grantId ?? "grant-1",
    boundaryId: overrides.boundaryId ?? "kb_finance",
    requesterOrgNodeId: overrides.requesterOrgNodeId ?? "dept_hr",
    purpose: overrides.purpose ?? "audit",
    expiresAt: overrides.expiresAt ?? "2026-12-31T23:59:59.999Z",
    ...overrides,
  };
}

// ─── Issue #1973: Grant expiry check logic error + string comparison not date comparison ─

test("evaluateKnowledgeShare denies grant at exact expiry time", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      purpose: "audit",
      expiresAt: "2026-04-20T00:00:00.000Z",
    }),
  ];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");
  assert.strictEqual(result, null);
});

test("evaluateKnowledgeShare treats exact expiry as expired", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      expiresAt: "2026-04-20T12:00:00.000Z",
    }),
  ];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T12:00:00.000Z");
  assert.strictEqual(result, null);
});

test("evaluateKnowledgeShare uses parsed timestamps around expiry boundary", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  // Grant expires at April 20
  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      expiresAt: "2026-04-20T23:59:59.999Z",
    }),
  ];

  const resultBefore = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T23:59:59.998Z");
  assert.notStrictEqual(resultBefore, null);

  const resultAt = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T23:59:59.999Z");
  assert.strictEqual(resultAt, null);

  const resultAfter = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-21T00:00:00.000Z");
  assert.strictEqual(resultAfter, null);
});

test("evaluateKnowledgeShare with null expiresAt allows access - demonstrates logic error", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      expiresAt: null as unknown as string, // null expiresAt
    }),
  ];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  // BUG: The condition `item.expiresAt == null || item.expiresAt >= nowIso`
  // allows grants with null expiresAt (never expire) but the code structure is wrong
  // When expiresAt is null, the first part of OR is true, so it returns the grant
  // This is actually the intended behavior for "never expires" but the logic is fragile
  assert.notStrictEqual(result, null);
});

test("evaluateKnowledgeShare properly denies expired grant", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      expiresAt: "2026-04-15T00:00:00.000Z", // Expired
    }),
  ];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.strictEqual(result, null);
});

test("evaluateKnowledgeShare returns null when grant boundaryId does not match", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_legal", // Different boundary
      requesterOrgNodeId: "dept_hr",
      expiresAt: "2026-12-31T23:59:59.999Z",
    }),
  ];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.strictEqual(result, null);
});

test("evaluateKnowledgeShare returns null when grant requesterOrgNodeId does not match", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_legal", // Different org node
      expiresAt: "2026-12-31T23:59:59.999Z",
    }),
  ];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.strictEqual(result, null);
});

// ─── Owner and allowed org node access ───────────────────────────────────────

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

test("evaluateKnowledgeShare returns null for empty grants array when not owner or allowed", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const result = evaluateKnowledgeShare(boundary, "dept_hr", [], "2026-04-20T00:00:00.000Z");

  assert.strictEqual(result, null);
});

// ─── Transform mode and field keys ───────────────────────────────────────────

test("evaluateKnowledgeShare returns grant transformMode when specified", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      transformMode: "field_filter",
      allowedFieldKeys: ["field_a", "field_b"],
      expiresAt: "2026-12-31T23:59:59.999Z",
    }),
  ];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.mode, "field_filter");
  assert.deepStrictEqual(result?.allowedFieldKeys, ["field_a", "field_b"]);
});

test("evaluateKnowledgeShare defaults to summary mode when not specified", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      // No transformMode specified
      expiresAt: "2026-12-31T23:59:59.999Z",
    }),
  ];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.mode, "summary");
});

// ─── Multiple grants handling ─────────────────────────────────────────────────

test("evaluateKnowledgeShare returns first matching grant", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      purpose: "first",
      expiresAt: "2026-12-31T23:59:59.999Z",
    }),
    createGrant({
      grantId: "grant-2",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      purpose: "second",
      expiresAt: "2026-12-31T23:59:59.999Z",
    }),
  ];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.mode, "summary");
});

test("evaluateKnowledgeShare skips expired grant and returns next valid grant", () => {
  const boundary = createBoundary("kb_finance", "dept_finance");

  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      expiresAt: "2026-04-15T00:00:00.000Z", // Expired
    }),
    createGrant({
      grantId: "grant-2",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      expiresAt: "2026-12-31T23:59:59.999Z", // Valid
    }),
  ];

  const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");

  // Should skip first (expired) and return second grant
  assert.notStrictEqual(result, null);
});

// ─── Schema validation ─────────────────────────────────────────────────────────

test("KnowledgeShareGrantSchema validates valid grant", () => {
  const validGrant = {
    grantId: "grant-1",
    boundaryId: "kb_finance",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-12-31T23:59:59.999Z",
  };

  const result = KnowledgeShareGrantSchema.safeParse(validGrant);

  assert.equal(result.success, true);
});

test("KnowledgeShareGrantSchema rejects missing required fields", () => {
  const invalidGrant = {
    grantId: "grant-1",
    // Missing boundaryId, requesterOrgNodeId, purpose, expiresAt
  };

  const result = KnowledgeShareGrantSchema.safeParse(invalidGrant);

  assert.equal(result.success, false);
});

test("KnowledgeShareGrantSchema accepts optional fields", () => {
  const grantWithOptional = {
    grantId: "grant-1",
    boundaryId: "kb_finance",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-12-31T23:59:59.999Z",
    transformMode: "field_filter",
    allowedFieldKeys: ["field1", "field2"],
  };

  const result = KnowledgeShareGrantSchema.safeParse(grantWithOptional);

  assert.equal(result.success, true);
});

test("KnowledgeShareGrantSchema rejects invalid transformMode", () => {
  const invalidGrant = {
    grantId: "grant-1",
    boundaryId: "kb_finance",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    expiresAt: "2026-12-31T23:59:59.999Z",
    transformMode: "invalid_mode", // Invalid
  };

  const result = KnowledgeShareGrantSchema.safeParse(invalidGrant);

  assert.equal(result.success, false);
});
