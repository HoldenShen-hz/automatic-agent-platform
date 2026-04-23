import assert from "node:assert/strict";
import test from "node:test";
import { evaluateKnowledgeShare, KnowledgeShareGrantSchema } from "../../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";
test("evaluateKnowledgeShare returns true for owner org node", () => {
    const boundary = {
        boundaryId: "kb_finance",
        ownerOrgNodeId: "dept_finance",
        namespaceIds: [],
        defaultVisibility: "private",
        allowedOrgNodeIds: [],
    };
    const result = evaluateKnowledgeShare(boundary, "dept_finance", [], "2026-04-20T00:00:00.000Z");
    assert.strictEqual(result, true);
});
test("evaluateKnowledgeShare returns true for allowed org node", () => {
    const boundary = {
        boundaryId: "kb_finance",
        ownerOrgNodeId: "dept_finance",
        namespaceIds: [],
        defaultVisibility: "private",
        allowedOrgNodeIds: ["dept_audit", "dept_compliance"],
    };
    const result = evaluateKnowledgeShare(boundary, "dept_audit", [], "2026-04-20T00:00:00.000Z");
    assert.strictEqual(result, true);
});
test("evaluateKnowledgeShare returns false for unauthorized org node without grant", () => {
    const boundary = {
        boundaryId: "kb_finance",
        ownerOrgNodeId: "dept_finance",
        namespaceIds: [],
        defaultVisibility: "private",
        allowedOrgNodeIds: [],
    };
    const result = evaluateKnowledgeShare(boundary, "dept_hr", [], "2026-04-20T00:00:00.000Z");
    assert.strictEqual(result, false);
});
test("evaluateKnowledgeShare returns true when valid grant exists", () => {
    const boundary = {
        boundaryId: "kb_finance",
        ownerOrgNodeId: "dept_finance",
        namespaceIds: [],
        defaultVisibility: "private",
        allowedOrgNodeIds: [],
    };
    const grants = [{
            grantId: "grant_1",
            boundaryId: "kb_finance",
            requesterOrgNodeId: "dept_hr",
            purpose: "audit",
            expiresAt: "2026-04-25T00:00:00.000Z",
        }];
    const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");
    assert.strictEqual(result, true);
});
test("evaluateKnowledgeShare returns false when grant is expired", () => {
    const boundary = {
        boundaryId: "kb_finance",
        ownerOrgNodeId: "dept_finance",
        namespaceIds: [],
        defaultVisibility: "private",
        allowedOrgNodeIds: [],
    };
    const grants = [{
            grantId: "grant_1",
            boundaryId: "kb_finance",
            requesterOrgNodeId: "dept_hr",
            purpose: "audit",
            expiresAt: "2026-04-15T00:00:00.000Z",
        }];
    const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");
    assert.strictEqual(result, false);
});
test("evaluateKnowledgeShare returns false when grant boundaryId does not match", () => {
    const boundary = {
        boundaryId: "kb_finance",
        ownerOrgNodeId: "dept_finance",
        namespaceIds: [],
        defaultVisibility: "private",
        allowedOrgNodeIds: [],
    };
    const grants = [{
            grantId: "grant_1",
            boundaryId: "kb_legal",
            requesterOrgNodeId: "dept_hr",
            purpose: "audit",
            expiresAt: "2026-04-25T00:00:00.000Z",
        }];
    const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");
    assert.strictEqual(result, false);
});
test("evaluateKnowledgeShare returns false when grant requesterOrgNodeId does not match", () => {
    const boundary = {
        boundaryId: "kb_finance",
        ownerOrgNodeId: "dept_finance",
        namespaceIds: [],
        defaultVisibility: "private",
        allowedOrgNodeIds: [],
    };
    const grants = [{
            grantId: "grant_1",
            boundaryId: "kb_finance",
            requesterOrgNodeId: "dept_legal",
            purpose: "audit",
            expiresAt: "2026-04-25T00:00:00.000Z",
        }];
    const result = evaluateKnowledgeShare(boundary, "dept_hr", grants, "2026-04-20T00:00:00.000Z");
    assert.strictEqual(result, false);
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
//# sourceMappingURL=sharing-gate.test.js.map