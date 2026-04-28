import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeFederator } from "../../../../src/org-governance/knowledge-boundary/knowledge-federator.js";
import type {
  FederatedKnowledgeSource,
  FederatedKnowledgeQuery,
  CrossBoundaryTransform,
} from "../../../../src/org-governance/knowledge-boundary/knowledge-federator.js";
import type { KnowledgeBoundary } from "../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";

function controlledBoundary(
  boundaryId: string,
  ownerOrgNodeId: string,
  allowedOrgNodeIds: readonly string[],
  tenantId: string | null = null,
): KnowledgeBoundary {
  return {
    boundaryId,
    ownerOrgNodeId,
    tenantId,
    namespaceIds: [],
    accessPolicy: "controlled",
    auditOnAccess: true,
    allowedOrgNodeIds: [...allowedOrgNodeIds],
    fieldAllowlist: [],
  };
}

// R3-32: CrossBoundaryTransform - summary mode
test("KnowledgeFederator.search applies summary transform for non-owner requester", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis for department", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", query: "budget" },
  );

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]!.transformApplied, "summary");
  // Summary truncates to 180 chars
  assert.ok(results[0]!.excerpt.length <= 180);
});

test("KnowledgeFederator.search applies no transform for owner requester", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis for department", tags: ["budget"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", []),
  ];

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_finance", query: "budget" },
  );

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]!.transformApplied, "none");
});

test("KnowledgeFederator.search applies field_filter transform when specified", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    {
      sourceId: "src_1",
      boundaryId: "kb_finance",
      orgNodeId: "dept_finance",
      title: "Budget Report",
      content: "Financial data",
      tags: ["budget"],
      structuredFields: { amount: "100000", department: "finance", owner: "john.doe@example.com" },
    },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    { ...controlledBoundary("kb_finance", "dept_finance", ["dept_audit"]), fieldAllowlist: ["amount", "department"] },
  ];
  const transform: CrossBoundaryTransform = { mode: "field_filter", allowedFieldKeys: ["amount", "department"] };

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_audit", query: "budget", transform },
  );

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]!.transformApplied, "field_filter");
  assert.ok(results[0]!.excerpt.includes("amount: 100000"));
  assert.ok(results[0]!.excerpt.includes("department: finance"));
});

test("KnowledgeFederator.search field_filter redacts non-allowed fields", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    {
      sourceId: "src_1",
      boundaryId: "kb_finance",
      orgNodeId: "dept_finance",
      title: "Budget Report",
      content: "Financial data",
      tags: ["budget"],
      structuredFields: { public_info: "visible", secret_code: "12345", owner_email: "secret@example.com" },
    },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    { ...controlledBoundary("kb_finance", "dept_finance", ["dept_audit"]), fieldAllowlist: ["public_info"] },
  ];
  const transform: CrossBoundaryTransform = { mode: "field_filter", allowedFieldKeys: ["public_info", "secret_code", "owner_email"] };

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_audit", query: "budget", transform },
  );

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]!.transformApplied, "field_filter");
  assert.ok(results[0]!.excerpt.includes("public_info: visible"));
  assert.ok(results[0]!.excerpt.includes("secret_code: [redacted]"));
  assert.ok(results[0]!.excerpt.includes("owner_email: [redacted]"));
});

test("KnowledgeFederator.search summary mode redacts emails and numbers", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    {
      sourceId: "src_1",
      boundaryId: "kb_finance",
      orgNodeId: "dept_finance",
      title: "Budget Report",
      content: "Contact john.doe@company.com for budget questions. Budget code 123456789.",
      tags: ["budget"],
    },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
  ];

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", query: "budget" },
  );

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]!.transformApplied, "summary");
  assert.ok(results[0]!.excerpt.includes("[redacted-email]"));
  assert.ok(results[0]!.excerpt.includes("[redacted-number]"));
  assert.ok(!results[0]!.excerpt.includes("john.doe@company.com"));
  assert.ok(!results[0]!.excerpt.includes("123456789"));
});

test("KnowledgeFederator.search CrossBoundaryTransform - empty allowedFieldKeys uses boundary allowlist", () => {
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
  const transform: CrossBoundaryTransform = { mode: "field_filter", allowedFieldKeys: [] };

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_audit", query: "report", transform },
  );

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]!.transformApplied, "field_filter");
  assert.ok(results[0]!.excerpt.includes("field_a: value_a"));
});

test("KnowledgeFederator.search CrossBoundaryTransform - boundary without allowlist redacts all", () => {
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

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_audit", query: "report", transform },
  );

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]!.transformApplied, "field_filter");
  assert.ok(results[0]!.excerpt.includes("sensitive: [redacted]"));
});

// R1-9/R4-46: Tenant isolation in federator search
test("KnowledgeFederator.search tenant isolation - same tenant allows access", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", tenantId: "tenant_a", title: "Report", content: "Budget data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"], "tenant_a"),
  ];

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: "tenant_a", query: "report" },
  );

  assert.strictEqual(results.length, 1);
});

test("KnowledgeFederator.search tenant isolation - different tenant denies access", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", tenantId: "tenant_a", title: "Report", content: "Budget data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"], "tenant_a"),
  ];

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: "tenant_b", query: "report" },
  );

  assert.strictEqual(results.length, 0);
});

test("KnowledgeFederator.search tenant isolation - null boundary tenant and null requester allows", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", tenantId: null, title: "Report", content: "Budget data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"], null),
  ];

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: null, query: "report" },
  );

  assert.strictEqual(results.length, 1);
});

test("KnowledgeFederator.search tenant isolation - boundary null, requester non-null denies", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", tenantId: null, title: "Report", content: "Budget data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"], null),
  ];

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: "tenant_x", query: "report" },
  );

  assert.strictEqual(results.length, 0);
});

test("KnowledgeFederator.search tenant isolation - source tenant and requester tenant mismatch", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", tenantId: "tenant_source", title: "Report", content: "Budget data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"], "tenant_source"),
  ];

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: "tenant_requester", query: "report" },
  );

  assert.strictEqual(results.length, 0);
});

test("KnowledgeFederator.search tenant isolation - all null allows access", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_open", orgNodeId: "dept_finance", tenantId: null, title: "Open Report", content: "Public data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_open", "dept_finance", [], null),
  ];

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: null, query: "report" },
  );

  assert.strictEqual(results.length, 1);
});

test("KnowledgeFederator.search tenant isolation - owner bypasses tenant check", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_tenant", orgNodeId: "dept_finance", tenantId: "tenant_a", title: "Report", content: "Internal", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_tenant", "dept_finance", [], "tenant_a"),
  ];

  // Owner access bypasses tenant check
  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_finance", requesterTenantId: "tenant_b", query: "report" },
  );

  assert.strictEqual(results.length, 1);
});

test("KnowledgeFederator.search tenant isolation - source tenant matches boundary tenant", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_match", orgNodeId: "dept_finance", tenantId: "tenant_match", title: "Report", content: "Data", tags: [] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_match", "dept_finance", ["dept_hr"], "tenant_match"),
  ];

  const results = federator.search(
    sources,
    boundaries,
    { requesterOrgNodeId: "dept_hr", requesterTenantId: "tenant_match", query: "report" },
  );

  assert.strictEqual(results.length, 1);
});

// Basic sanity tests (retained from original)
test("KnowledgeFederator.search returns empty array for empty or whitespace query", () => {
  const federator = new KnowledgeFederator();
  assert.deepStrictEqual(federator.search([], [], { requesterOrgNodeId: "dept_hr", query: "" }), []);
  assert.deepStrictEqual(federator.search([], [], { requesterOrgNodeId: "dept_hr", query: "   " }), []);
});

test("KnowledgeFederator.search filters by boundaryIds and explicit authorization", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget", "finance"] },
    { sourceId: "src_2", boundaryId: "kb_hr", orgNodeId: "dept_hr", title: "Employee Handbook", content: "Company policies", tags: ["hr", "policies"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_hr"]),
    controlledBoundary("kb_hr", "dept_hr", ["dept_hr"]),
  ];
  const query: FederatedKnowledgeQuery = {
    requesterOrgNodeId: "dept_hr",
    query: "budget",
    boundaryIds: ["kb_finance"],
  };

  const results = federator.search(sources, boundaries, query);

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]!.sourceId, "src_1");
});

test("KnowledgeFederator.search excludes missing or unauthorized boundaries", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget"] },
  ];

  assert.strictEqual(
    federator.search(sources, [], { requesterOrgNodeId: "dept_hr", query: "budget" }).length,
    0,
  );

  const strictBoundary: KnowledgeBoundary = {
    boundaryId: "kb_finance",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    accessPolicy: "strict",
    auditOnAccess: true,
    allowedOrgNodeIds: [],
    fieldAllowlist: [],
  };
  assert.strictEqual(
    federator.search(sources, [strictBoundary], { requesterOrgNodeId: "dept_hr", query: "budget" }).length,
    0,
  );
});

test("KnowledgeFederator.search allows owner and explicit allowlist access", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget"] },
  ];

  const ownerBoundary: KnowledgeBoundary = {
    boundaryId: "kb_finance",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    accessPolicy: "strict",
    auditOnAccess: true,
    allowedOrgNodeIds: [],
    fieldAllowlist: [],
  };
  assert.strictEqual(
    federator.search(sources, [ownerBoundary], { requesterOrgNodeId: "dept_finance", query: "budget" }).length,
    1,
  );

  const allowlistBoundary = controlledBoundary("kb_finance", "dept_finance", ["dept_audit"]);
  assert.strictEqual(
    federator.search(sources, [allowlistBoundary], { requesterOrgNodeId: "dept_audit", query: "budget" }).length,
    1,
  );
});

test("KnowledgeFederator.search matches query in title, content, and tags", () => {
  const federator = new KnowledgeFederator();
  const boundaries = [controlledBoundary("kb_finance", "dept_finance", ["dept_hr"])];

  assert.strictEqual(
    federator.search(
      [{ sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report 2026", content: "Financial summary", tags: ["finance"] }],
      boundaries,
      { requesterOrgNodeId: "dept_hr", query: "Budget" },
    ).length,
    1,
  );

  assert.strictEqual(
    federator.search(
      [{ sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: "Q1 budget analysis document", tags: ["finance"] }],
      boundaries,
      { requesterOrgNodeId: "dept_hr", query: "budget" },
    ).length,
    1,
  );

  const tagResults = federator.search(
    [{ sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: "Financial summary", tags: ["budget", "quarterly"] }],
    boundaries,
    { requesterOrgNodeId: "dept_hr", query: "BUDGET" },
  );
  assert.strictEqual(tagResults.length, 1);
  assert.ok(tagResults[0]!.matchedTags.includes("budget"));
});

test("KnowledgeFederator.search truncates excerpts to 180 chars", () => {
  const federator = new KnowledgeFederator();
  const longContent = "A".repeat(300);
  const results = federator.search(
    [{ sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: longContent, tags: [] }],
    [controlledBoundary("kb_finance", "dept_finance", ["dept_hr"])],
    { requesterOrgNodeId: "dept_hr", query: "Report" },
  );

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]!.excerpt.length, 180);
});

test("KnowledgeFederator.search applies chinese wall policy", () => {
  const federator = new KnowledgeFederator();
  const sources: readonly FederatedKnowledgeSource[] = [
    { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget", tags: ["budget"] },
    { sourceId: "src_2", boundaryId: "kb_legal", orgNodeId: "dept_legal", title: "Legal Policy", content: "Compliance docs", tags: ["legal"] },
  ];
  const boundaries: readonly KnowledgeBoundary[] = [
    controlledBoundary("kb_finance", "dept_finance", ["dept_finance"]),
    controlledBoundary("kb_legal", "dept_legal", ["dept_finance"]),
  ];
  const policy = {
    policyId: "cwp_1",
    conflictGroups: {
      group_finance_legal: ["dept_finance", "dept_legal"],
    },
  };

  const results = federator.search(sources, boundaries, {
    requesterOrgNodeId: "dept_finance",
    query: "Report",
  }, policy);

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]!.sourceId, "src_1");
});

test("KnowledgeFederator.search summarizes and redacts content across knowledge boundaries", () => {
  const federator = new KnowledgeFederator();
  const results = federator.search(
    [{
      sourceId: "src_1",
      boundaryId: "kb_finance",
      orgNodeId: "dept_finance",
      title: "Budget Report",
      content: "Revenue 123456 and contact finance@example.com are sensitive details",
      tags: ["budget"],
    }],
    [controlledBoundary("kb_finance", "dept_finance", ["dept_hr"])],
    { requesterOrgNodeId: "dept_hr", query: "budget" },
  );

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]!.transformApplied, "summary");
  assert.ok(results[0]!.excerpt.includes("[redacted-number]"));
  assert.ok(results[0]!.excerpt.includes("[redacted-email]"));
});