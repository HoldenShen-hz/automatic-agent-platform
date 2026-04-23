import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeFederator } from "../../../../src/org-governance/knowledge-boundary/knowledge-federator.js";
test("KnowledgeFederator.search returns empty array for empty query", () => {
    const federator = new KnowledgeFederator();
    const sources = [];
    const boundaries = [];
    const query = {
        requesterOrgNodeId: "dept_hr",
        query: "",
    };
    const results = federator.search(sources, boundaries, query);
    assert.deepStrictEqual(results, []);
});
test("KnowledgeFederator.search returns empty array for whitespace-only query", () => {
    const federator = new KnowledgeFederator();
    const sources = [];
    const boundaries = [];
    const query = {
        requesterOrgNodeId: "dept_hr",
        query: "   ",
    };
    const results = federator.search(sources, boundaries, query);
    assert.deepStrictEqual(results, []);
});
test("KnowledgeFederator.search filters by boundaryIds when provided", () => {
    const federator = new KnowledgeFederator();
    const sources = [
        { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget", "finance"] },
        { sourceId: "src_2", boundaryId: "kb_hr", orgNodeId: "dept_hr", title: "Employee Handbook", content: "Company policies", tags: ["hr", "policies"] },
    ];
    const boundaries = [
        { boundaryId: "kb_finance", ownerOrgNodeId: "dept_finance", namespaceIds: [], defaultVisibility: "public", allowedOrgNodeIds: [] },
        { boundaryId: "kb_hr", ownerOrgNodeId: "dept_hr", namespaceIds: [], defaultVisibility: "public", allowedOrgNodeIds: [] },
    ];
    const query = {
        requesterOrgNodeId: "dept_hr",
        query: "budget",
        boundaryIds: ["kb_finance"],
    };
    const results = federator.search(sources, boundaries, query);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].sourceId, "src_1");
});
test("KnowledgeFederator.search excludes sources without matching boundary", () => {
    const federator = new KnowledgeFederator();
    const sources = [
        { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget"] },
    ];
    const boundaries = [];
    const query = {
        requesterOrgNodeId: "dept_hr",
        query: "budget",
    };
    const results = federator.search(sources, boundaries, query);
    assert.strictEqual(results.length, 0);
});
test("KnowledgeFederator.search filters by visibility for private boundary", () => {
    const federator = new KnowledgeFederator();
    const sources = [
        { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget"] },
    ];
    const boundaries = [
        { boundaryId: "kb_finance", ownerOrgNodeId: "dept_finance", namespaceIds: [], defaultVisibility: "private", allowedOrgNodeIds: [] },
    ];
    const query = {
        requesterOrgNodeId: "dept_hr",
        query: "budget",
    };
    const results = federator.search(sources, boundaries, query);
    assert.strictEqual(results.length, 0);
});
test("KnowledgeFederator.search allows owner org node access to private boundary", () => {
    const federator = new KnowledgeFederator();
    const sources = [
        { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget"] },
    ];
    const boundaries = [
        { boundaryId: "kb_finance", ownerOrgNodeId: "dept_finance", namespaceIds: [], defaultVisibility: "private", allowedOrgNodeIds: [] },
    ];
    const query = {
        requesterOrgNodeId: "dept_finance",
        query: "budget",
    };
    const results = federator.search(sources, boundaries, query);
    assert.strictEqual(results.length, 1);
});
test("KnowledgeFederator.search allows allowedOrgNodeIds access to private boundary", () => {
    const federator = new KnowledgeFederator();
    const sources = [
        { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget analysis", tags: ["budget"] },
    ];
    const boundaries = [
        { boundaryId: "kb_finance", ownerOrgNodeId: "dept_finance", namespaceIds: [], defaultVisibility: "private", allowedOrgNodeIds: ["dept_audit"] },
    ];
    const query = {
        requesterOrgNodeId: "dept_audit",
        query: "budget",
    };
    const results = federator.search(sources, boundaries, query);
    assert.strictEqual(results.length, 1);
});
test("KnowledgeFederator.search matches query in title", () => {
    const federator = new KnowledgeFederator();
    const sources = [
        { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report 2026", content: "Financial summary", tags: ["finance"] },
    ];
    const boundaries = [
        { boundaryId: "kb_finance", ownerOrgNodeId: "dept_finance", namespaceIds: [], defaultVisibility: "public", allowedOrgNodeIds: [] },
    ];
    const query = {
        requesterOrgNodeId: "dept_hr",
        query: "Budget",
    };
    const results = federator.search(sources, boundaries, query);
    assert.strictEqual(results.length, 1);
});
test("KnowledgeFederator.search matches query in content", () => {
    const federator = new KnowledgeFederator();
    const sources = [
        { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: "Q1 budget analysis document", tags: ["finance"] },
    ];
    const boundaries = [
        { boundaryId: "kb_finance", ownerOrgNodeId: "dept_finance", namespaceIds: [], defaultVisibility: "public", allowedOrgNodeIds: [] },
    ];
    const query = {
        requesterOrgNodeId: "dept_hr",
        query: "budget",
    };
    const results = federator.search(sources, boundaries, query);
    assert.strictEqual(results.length, 1);
});
test("KnowledgeFederator.search matches query in tags", () => {
    const federator = new KnowledgeFederator();
    const sources = [
        { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: "Financial summary", tags: ["budget", "quarterly"] },
    ];
    const boundaries = [
        { boundaryId: "kb_finance", ownerOrgNodeId: "dept_finance", namespaceIds: [], defaultVisibility: "public", allowedOrgNodeIds: [] },
    ];
    const query = {
        requesterOrgNodeId: "dept_hr",
        query: "BUDGET",
    };
    const results = federator.search(sources, boundaries, query);
    assert.strictEqual(results.length, 1);
    assert.ok(results[0].matchedTags.includes("budget"));
});
test("KnowledgeFederator.search returns excerpt truncated to 180 chars", () => {
    const federator = new KnowledgeFederator();
    const longContent = "A".repeat(300);
    const sources = [
        { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Report", content: longContent, tags: [] },
    ];
    const boundaries = [
        { boundaryId: "kb_finance", ownerOrgNodeId: "dept_finance", namespaceIds: [], defaultVisibility: "public", allowedOrgNodeIds: [] },
    ];
    const query = {
        requesterOrgNodeId: "dept_hr",
        query: "Report",
    };
    const results = federator.search(sources, boundaries, query);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].excerpt.length, 180);
});
test("KnowledgeFederator.search applies chinese wall policy", () => {
    const federator = new KnowledgeFederator();
    const sources = [
        { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 budget", tags: ["budget"] },
        { sourceId: "src_2", boundaryId: "kb_legal", orgNodeId: "dept_legal", title: "Legal Policy", content: "Compliance docs", tags: ["legal"] },
    ];
    const boundaries = [
        { boundaryId: "kb_finance", ownerOrgNodeId: "dept_finance", namespaceIds: [], defaultVisibility: "public", allowedOrgNodeIds: [] },
        { boundaryId: "kb_legal", ownerOrgNodeId: "dept_legal", namespaceIds: [], defaultVisibility: "public", allowedOrgNodeIds: [] },
    ];
    const policy = {
        policyId: "cwp_1",
        conflictGroups: {
            "group_finance_legal": ["dept_finance", "dept_legal"],
        },
    };
    const query = {
        requesterOrgNodeId: "dept_finance",
        query: "Report",
    };
    const results = federator.search(sources, boundaries, query, policy);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].sourceId, "src_1");
});
test("KnowledgeFederator.search is case insensitive", () => {
    const federator = new KnowledgeFederator();
    const sources = [
        { sourceId: "src_1", boundaryId: "kb_finance", orgNodeId: "dept_finance", title: "Budget Report", content: "Q1 analysis", tags: ["FINANCE"] },
    ];
    const boundaries = [
        { boundaryId: "kb_finance", ownerOrgNodeId: "dept_finance", namespaceIds: [], defaultVisibility: "public", allowedOrgNodeIds: [] },
    ];
    const query = {
        requesterOrgNodeId: "dept_hr",
        query: "BUDGET",
    };
    const results = federator.search(sources, boundaries, query);
    assert.strictEqual(results.length, 1);
});
//# sourceMappingURL=knowledge-federator.test.js.map