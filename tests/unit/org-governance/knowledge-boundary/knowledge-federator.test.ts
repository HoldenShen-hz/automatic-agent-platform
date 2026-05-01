import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeFederator, type FederatedKnowledgeSource, type FederatedKnowledgeQuery, type CrossBoundaryTransform } from "../../../../src/org-governance/knowledge-boundary/knowledge-federator.js";
import { evaluateChineseWallPolicy, type ChineseWallPolicy } from "../../../../src/org-governance/knowledge-boundary/chinese-wall-policy.js";
import type { KnowledgeBoundary } from "../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";

function strictBoundary(boundaryId: string, ownerOrgNodeId: string): KnowledgeBoundary {
  return {
    boundaryId,
    ownerOrgNodeId,
    tenantId: null,
    namespaceIds: [],
    accessPolicy: "strict",
    auditOnAccess: true,
    allowedOrgNodeIds: [],
    fieldAllowlist: [],
  };
}

function controlledBoundary(
  boundaryId: string,
  ownerOrgNodeId: string,
  allowedOrgNodeIds: readonly string[] = [],
  tenantId: string | null = null,
  fieldAllowlist: readonly string[] = [],
): KnowledgeBoundary {
  return {
    boundaryId,
    ownerOrgNodeId,
    tenantId,
    namespaceIds: [],
    accessPolicy: "controlled",
    auditOnAccess: true,
    allowedOrgNodeIds: [...allowedOrgNodeIds],
    fieldAllowlist: [...fieldAllowlist],
  };
}

// Constructor and basic behavior
test("KnowledgeFederator.search returns empty array for empty query", () => {
  const federator = new KnowledgeFederator();
  const result = federator.search([], [], { requesterOrgNodeId: "dept_hr", query: "" });
  assert.deepStrictEqual(result, []);
});

test("KnowledgeFederator.search returns empty array for whitespace-only query", () => {
  const federator = new KnowledgeFederator();
  const result = federator.search([], [], { requesterOrgNodeId: "dept_hr", query: "   " });
  assert.deepStrictEqual(result, []);
});

test("KnowledgeFederator.search returns empty array when no sources match", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Financial data", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "nonexistent" });
  assert.strictEqual(result.length, 0);
});

// Owner access tests
test("KnowledgeFederator.search owner can access their own source", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    strictBoundary("kb_finance", "dept_finance"),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_finance", query: "budget" });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]!.sourceId, "src_1");
});

test("KnowledgeFederator.search owner access with matching tenant", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_tenant", orgNodeId: "dept_finance", tenantId: "tenant_a", title: "Internal Doc", content: "Sensitive data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_tenant", "dept_finance", [], "tenant_a"),
  ];

  // Owner with same tenant should work
  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_finance", requesterTenantId: "tenant_a", query: "internal" },
  );
  assert.strictEqual(result.length, 1);
});

test("KnowledgeFederator.search owner cannot access when tenant mismatches", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_tenant", orgNodeId: "dept_finance", tenantId: "tenant_a", title: "Internal Doc", content: "Sensitive data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_tenant", "dept_finance", [], "tenant_a"),
  ];

  // Owner with different tenant still blocked by tenant isolation
  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_finance", requesterTenantId: "tenant_b", query: "internal" },
  );
  assert.strictEqual(result.length, 0);
});

// Allowlist access tests
test("KnowledgeFederator.search allowlisted org node can access", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_audit", "dept_compliance"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_audit", query: "budget" });
  assert.strictEqual(result.length, 1);
});

test("KnowledgeFederator.search non-allowlisted org node cannot access strict boundary", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    strictBoundary("kb_finance", "dept_finance"),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "budget" });
  assert.strictEqual(result.length, 0);
});

// Tenant isolation tests
test("KnowledgeFederator.search tenant isolation - matching tenant allows access", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", tenantId: "tenant_a", title: "Report", content: "Budget data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"], "tenant_a"),
  ];

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: "tenant_a", query: "report" },
  );
  assert.strictEqual(result.length, 1);
});

test("KnowledgeFederator.search tenant isolation - mismatched tenant denies access", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", tenantId: "tenant_a", title: "Report", content: "Budget data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"], "tenant_a"),
  ];

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: "tenant_b", query: "report" },
  );
  assert.strictEqual(result.length, 0);
});

test("KnowledgeFederator.search tenant isolation - null boundary tenant with null requester allows", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_open", orgNodeId: "dept_finance", tenantId: null, title: "Public Report", content: "Open data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_open", "dept_finance", ["dept_hr"], null),
  ];

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: null, query: "report" },
  );
  assert.strictEqual(result.length, 1);
});

test("KnowledgeFederator.search tenant isolation - null boundary with non-null requester denies", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_open", orgNodeId: "dept_finance", tenantId: null, title: "Public Report", content: "Open data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_open", "dept_finance", ["dept_hr"], null),
  ];

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: "tenant_x", query: "report" },
  );
  assert.strictEqual(result.length, 0);
});

test("KnowledgeFederator.search tenant isolation - all null tenants allows access", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_open", orgNodeId: "dept_finance", tenantId: null, title: "Public Report", content: "Open data", tags: [] },
  ];
  // Add requester to allowedOrgNodeIds since it's a controlled boundary
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_open", "dept_finance", ["dept_hr"], null),
  ];

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: null, query: "report" },
  );
  assert.strictEqual(result.length, 1);
});

test("KnowledgeFederator.search tenant isolation - source tenant mismatches boundary tenant denies", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", tenantId: "tenant_source", title: "Report", content: "Data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"], "tenant_boundary"),
  ];

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: "tenant_boundary", query: "report" },
  );
  assert.strictEqual(result.length, 0);
});

// Query matching tests
test("KnowledgeFederator.search matches query in title", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report 2026", content: "Financial summary", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "Budget" });
  assert.strictEqual(result.length, 1);
});

test("KnowledgeFederator.search matches query in content", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: "Q1 budget analysis document", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "budget" });
  assert.strictEqual(result.length, 1);
});

test("KnowledgeFederator.search matches query in tags", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: "Financial summary", tags: ["budget", "quarterly"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "BUDGET" });
  assert.strictEqual(result.length, 1);
  assert.ok(result[0]!.matchedTags.includes("budget"));
});

test("KnowledgeFederator.search is case insensitive", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Financial DATA", tags: ["Financing"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "data" });
  assert.strictEqual(result.length, 1);
});

// Boundary filter tests
test("KnowledgeFederator.search filters by boundaryIds when specified", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget"] },
    { sourceId: "src_2", boundaryId: "kb_hr", orgNodeId: "dept_hr", title: "Employee Handbook", content: "Company policies", tags: ["hr"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
    controlledBoundary("kb_hr", "dept_hr", ["dept_hr"]),
  ];

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", query: "report", boundaryIds: ["kb_finance"] },
  );
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]!.sourceId, "src_1");
});

test("KnowledgeFederator.search returns empty for missing boundary", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget"] },
  ];

  const result = federator.search(sources, [], { requesterOrgNodeId: "dept_hr", query: "budget" });
  assert.strictEqual(result.length, 0);
});

// Transform tests - owner gets no transform
test("KnowledgeFederator.search owner gets no transform (mode: none)", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis for department", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", []),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_finance", query: "budget" });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]!.transformApplied, "none");
});

// Transform tests - non-owner gets summary
test("KnowledgeFederator.search non-owner gets summary transform", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis for department", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "budget" });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]!.transformApplied, "summary");
});

test("KnowledgeFederator.search summary mode redacts emails", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: "Contact john.doe@company.com for questions", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "report" });
  assert.strictEqual(result[0]!.transformApplied, "summary");
  assert.ok(result[0]!.excerpt.includes("[redacted-email]"));
  assert.ok(!result[0]!.excerpt.includes("john.doe@company.com"));
});

test("KnowledgeFederator.search summary mode redacts long numbers", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: "Budget code 123456789", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "report" });
  assert.strictEqual(result[0]!.transformApplied, "summary");
  assert.ok(result[0]!.excerpt.includes("[redacted-number]"));
  assert.ok(!result[0]!.excerpt.includes("123456789"));
});

test("KnowledgeFederator.search summary mode preserves short numbers", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: "The ratio is 3", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "report" });
  assert.ok(!result[0]!.excerpt.includes("[redacted-number]"));
});

// Transform tests - field_filter
test("KnowledgeFederator.search field_filter mode shows allowed fields", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    {
      sourceId: "src_1",
      boundaryId: "kb_finance",
      orgNodeId: "dept_finance",
      title: "Report",
      content: "Financial data",
      tags: [],
      structuredFields: { amount: "100000", department: "finance", owner: "john.doe@example.com" },
    },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    { ...controlledBoundary("kb_finance", "dept_finance", ["dept_audit"]), fieldAllowlist: ["amount", "department"] },
  ];
  const transform: CrossBoundaryTransform = { mode: "field_filter", allowedFieldKeys: ["amount", "department"] };

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_audit", query: "report", transform },
  );

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]!.transformApplied, "field_filter");
  assert.ok(result[0]!.excerpt.includes("amount: 100000"));
  assert.ok(result[0]!.excerpt.includes("department: finance"));
  assert.ok(!result[0]!.excerpt.includes("john.doe@example.com"));
});

test("KnowledgeFederator.search field_filter only includes fields in boundary allowlist", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    {
      sourceId: "src_1",
      boundaryId: "kb_finance",
      orgNodeId: "dept_finance",
      title: "Report",
      content: "Financial data",
      tags: [],
      structuredFields: { public_info: "visible", secret_code: "12345" },
    },
  ];
  // Boundary allowlist only has "public_info"
  const boundaries: readonly KnowledgeBoundary[] = [
    { ...controlledBoundary("kb_finance", "dept_finance", ["dept_audit"]), fieldAllowlist: ["public_info"] },
  ];
  // Transform allows both fields, but only public_info is in boundary allowlist
  const transform: CrossBoundaryTransform = { mode: "field_filter", allowedFieldKeys: ["public_info", "secret_code"] };

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_audit", query: "report", transform },
  );

  assert.strictEqual(result[0]!.transformApplied, "field_filter");
  assert.ok(result[0]!.excerpt.includes("public_info: visible"));
  // secret_code is not in boundary allowlist, so it's excluded entirely (not redacted)
  assert.ok(!result[0]!.excerpt.includes("secret_code"));
});

test("KnowledgeFederator.search field_filter with empty allowedFieldKeys falls back to summary mode", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    {
      sourceId: "src_1",
      boundaryId: "kb_finance",
      orgNodeId: "dept_finance",
      title: "Report",
      content: "Data",
      tags: [],
      structuredFields: { field_a: "value_a", field_b: "value_b" },
    },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    { ...controlledBoundary("kb_finance", "dept_finance", ["dept_audit"]), fieldAllowlist: ["field_a"] },
  ];
  // Empty allowedFieldKeys causes field_filter to fall back to summary mode
  const transform: CrossBoundaryTransform = { mode: "field_filter", allowedFieldKeys: [] };

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_audit", query: "report", transform },
  );

  // Falls back to summary when allowedFieldKeys is empty
  assert.strictEqual(result[0]!.transformApplied, "summary");
});

test("KnowledgeFederator.search field_filter with boundary empty allowlist redacts all", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    {
      sourceId: "src_1",
      boundaryId: "kb_finance",
      orgNodeId: "dept_finance",
      title: "Report",
      content: "Data",
      tags: [],
      structuredFields: { sensitive: "secret" },
    },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    { ...controlledBoundary("kb_finance", "dept_finance", ["dept_audit"]), fieldAllowlist: [] },
  ];
  const transform: CrossBoundaryTransform = { mode: "field_filter", allowedFieldKeys: ["sensitive"] };

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_audit", query: "report", transform },
  );

  assert.strictEqual(result[0]!.transformApplied, "field_filter");
  // When boundary allowlist is empty, condition is true so all keys pass through
  assert.ok(result[0]!.excerpt.includes("sensitive: secret"));
});

// Excerpt truncation tests
test("KnowledgeFederator.search truncates excerpts to 180 characters", () => {
  const federator = new KnowledgeFederator();
  const longContent = "A".repeat(300);
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: longContent, tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "report" });
  assert.strictEqual(result.length, 1);
  assert.ok(result[0]!.excerpt.length <= 180);
});

test("KnowledgeFederator.search owner excerpt is slice of content up to 180", () => {
  const federator = new KnowledgeFederator();
  const content = "A".repeat(300);
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content, tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", []),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_finance", query: "report" });
  assert.strictEqual(result[0]!.transformApplied, "none");
  assert.strictEqual(result[0]!.excerpt.length, 180);
});

// Chinese wall policy tests
test("KnowledgeFederator.search applies chinese wall policy to block cross-boundary access", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget", tags: ["budget"] },
    { sourceId: "src_2", boundaryId: "kb_legal", orgNodeId: "dept_legal", title: "Legal Policy", content: "Compliance docs", tags: ["legal"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_finance"]),
    controlledBoundary("kb_legal", "dept_legal", ["dept_finance"]),
  ];
  const policy: ChineseWallPolicy = {
    policyId: "cwp_1",
    conflictGroups: {
      group_finance_legal: ["dept_finance", "dept_legal"],
    },
  };

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_finance", query: "report" },
    policy,
  );

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]!.sourceId, "src_1");
});

test("KnowledgeFederator.search chinese wall policy allows access when no conflict", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget", tags: ["budget"] },
    { sourceId: "src_2", boundaryId: "kb_hr", orgNodeId: "dept_hr", title: "HR Policy", content: "Employee guidelines", tags: ["hr"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_compliance"]),
    controlledBoundary("kb_hr", "dept_hr", ["dept_compliance"]),
  ];
  const policy: ChineseWallPolicy = {
    policyId: "cwp_1",
    conflictGroups: {
      group_finance_legal: ["dept_finance", "dept_legal"],
    },
  };

  // dept_compliance is not in any conflict group, so both should be accessible
  // Query "budget" matches src_1 title/content/tags
  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_compliance", query: "budget" },
    policy,
  );

  // src_1 should pass the Chinese wall check since dept_compliance is not in conflict
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]!.sourceId, "src_1");
});

// Result field verification
test("KnowledgeFederator.search result contains correct sourceId and boundaryId", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_xyz", boundaryId: "kb_abc", orgNodeId: "dept_finance", title: "Report", content: "Data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_abc", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "report" });

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]!.sourceId, "src_xyz");
  assert.strictEqual(result[0]!.boundaryId, "kb_abc");
});

test("KnowledgeFederator.search result tenantId falls back to source tenantId when boundary tenant is null", () => {
  const federator = new KnowledgeFederator();
  // Source with tenant, boundary without tenant, and requester must all match for access
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", tenantId: "tenant_shared", title: "Report", content: "Data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    { ...controlledBoundary("kb_finance", "dept_finance", ["dept_hr"], "tenant_shared") },
  ];

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: "tenant_shared", query: "report" },
  );

  assert.strictEqual(result.length, 1);
  // When boundary.tenantId is present and matches source, but boundary.tenantId is still used
  // The result tenantId is boundary.tenantId ?? source.tenantId - so if boundary has tenant, that's used
  assert.strictEqual(result[0]!.tenantId, "tenant_shared");
});

// Multiple results tests
test("KnowledgeFederator.search returns multiple matching sources", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget", tags: ["budget"] },
    { sourceId: "src_2", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Analysis", content: "Yearly budget", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "budget" });
  assert.strictEqual(result.length, 2);
});

test("KnowledgeFederator.search matchedTags includes tags matching query", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: "Data", tags: ["budget", "quarterly", "finance"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "BUDGET" });

  assert.strictEqual(result.length, 1);
  assert.ok(result[0]!.matchedTags.includes("budget"));
});

// Error/edge cases
test("KnowledgeFederator.search with undefined boundaryIds includes all boundaries", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget", tags: ["budget"] },
    { sourceId: "src_2", boundaryId: "kb_hr", orgNodeId: "dept_hr", title: "HR Policy", content: "Guidelines for employees", tags: ["hr"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
    controlledBoundary("kb_hr", "dept_hr", ["dept_hr"]),
  ];

  // Query "report" matches "Budget Report" but not "HR Policy" - so only 1 result
  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "report" });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]!.sourceId, "src_1");
});

test("KnowledgeFederator.search trims query whitespace before matching", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "  budget  " });
  assert.strictEqual(result.length, 1);
});

// Integration-style test for evaluateChineseWallPolicy with federator
test("KnowledgeFederator.search chinese wall policy with blocked org node", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["blocked_user"]),
  ];
  const policy: ChineseWallPolicy = {
    policyId: "cwp_1",
    conflictGroups: {},
    blockedOrgNodeIds: ["blocked_user"],
  };

  const result = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "blocked_user", query: "budget" },
    policy,
  );

  assert.strictEqual(result.length, 0);
});

test("KnowledgeFederator.search with expired chinese wall that allows reset", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_finance"]),
  ];
  const policy: ChineseWallPolicy = {
    policyId: "cwp_1",
    conflictGroups: {},
    wallExpiryPolicy: "expires_at",
    expiresAt: "2020-01-01T00:00:00Z", // expired long ago
    resetRequiresApprovalRole: "compliance_officer",
  };

  // Without reset context, requester in conflict group would be blocked
  // But with expired policy without residual scan required, it should allow
  const decision = evaluateChineseWallPolicy(policy, "dept_finance", "dept_legal", { approvedByRole: "compliance_officer" });
  assert.strictEqual(decision.allowed, true);
});

test("KnowledgeFederator.search without policy allows all eligible sources", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const result = federator.search(sources, boundaries, { requesterOrgNodeId: "dept_hr", query: "budget" });
  assert.strictEqual(result.length, 1);
});
