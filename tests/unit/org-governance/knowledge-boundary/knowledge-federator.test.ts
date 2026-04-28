import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeFederator } from "../../../../src/org-governance/knowledge-boundary/knowledge-federator.js";
import type {
  FederatedKnowledgeSource,
  FederatedKnowledgeQuery,
} from "../../../../src/org-governance/knowledge-boundary/knowledge-federator.js";
import type { KnowledgeBoundary } from "../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";

function controlledBoundary(
  boundaryId: string,
  ownerOrgNodeId: string,
  allowedOrgNodeIds: readonly string[],
): KnowledgeBoundary {
  return {
    boundaryId,
    ownerOrgNodeId,
    namespaceIds: [],
    accessPolicy: "controlled",
    auditOnAccess: true,
    allowedOrgNodeIds,
    fieldAllowlist: [],
  };
}

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
