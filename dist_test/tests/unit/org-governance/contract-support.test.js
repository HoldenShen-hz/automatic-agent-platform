import assert from "node:assert/strict";
import test from "node:test";
import { resolveDelegatedApprover } from "../../../src/org-governance/approval-routing/delegation/index.js";
import { shouldEscalateApproval } from "../../../src/org-governance/approval-routing/escalation/index.js";
import { resolveApprovalRoute } from "../../../src/org-governance/approval-routing/route-engine/index.js";
import { buildGovernanceAuditRecord } from "../../../src/org-governance/compliance-engine/audit-enforcer/index.js";
import { inheritPolicyLayers } from "../../../src/org-governance/compliance-engine/inheritance/index.js";
import { resolveCompliancePolicyForNode } from "../../../src/org-governance/compliance-engine/policy-resolver/index.js";
import { listActiveGovernanceDelegations } from "../../../src/org-governance/delegated-governance/delegation-registry/index.js";
import { matchesGovernanceScope } from "../../../src/org-governance/delegated-governance/scope-manager/index.js";
import { redactKnowledgeAccessLog } from "../../../src/org-governance/knowledge-boundary/access-log/index.js";
import { canAccessKnowledgeBoundary } from "../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";
import { evaluateKnowledgeShare } from "../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";
import { listAncestorNodeIds, validateOrgHierarchy } from "../../../src/org-governance/org-model/hierarchy/index.js";
import { isLeafOrgNode } from "../../../src/org-governance/org-model/org-node/index.js";
import { mergeOrgNodes } from "../../../src/org-governance/org-model/sync/index.js";
import { buildOidcAuthorizationUrl } from "../../../src/org-governance/sso-scim/oidc/index.js";
import { buildSamlAudience } from "../../../src/org-governance/sso-scim/saml/index.js";
import { isTerminalScimAction } from "../../../src/org-governance/sso-scim/scim-sync/index.js";
const orgNodes = [
    { orgNodeId: "ent_1", nodeType: "company", displayName: "Enterprise", parentOrgNodeId: null, ownerUserIds: ["ceo"], active: true, metadata: {}, costCenter: "" },
    { orgNodeId: "dept_1", nodeType: "department", displayName: "Platform", parentOrgNodeId: "ent_1", ownerUserIds: ["director"], active: true, metadata: {}, costCenter: "" },
    { orgNodeId: "team_1", nodeType: "team", displayName: "Runtime", parentOrgNodeId: "dept_1", ownerUserIds: ["manager"], active: true, metadata: {}, costCenter: "" },
    { orgNodeId: "seat_1", nodeType: "member", displayName: "Engineer", parentOrgNodeId: "team_1", ownerUserIds: ["engineer"], active: true, metadata: {}, costCenter: "" },
];
test("org-governance support modules expose contract-aligned helpers", () => {
    assert.equal(resolveDelegatedApprover([
        {
            delegationId: "del_1",
            approverId: "manager",
            delegateApproverId: "backup_manager",
            scopeNodeIds: ["team_1"],
            startsAt: "2026-04-20T00:00:00.000Z",
            expiresAt: "2026-04-21T00:00:00.000Z",
            active: true,
        },
    ], "manager", "team_1", "2026-04-20T12:00:00.000Z"), "backup_manager");
    assert.equal(shouldEscalateApproval({
        ruleId: "esc_1",
        triggerAfterMinutes: 30,
        escalateToApproverId: "director",
        appliesToRiskLevels: ["high", "critical"],
    }, "2026-04-20T00:00:00.000Z", "2026-04-20T00:31:00.000Z", "high"), true);
    assert.deepEqual(resolveApprovalRoute(orgNodes, {
        requesterId: "user_1",
        orgNodeId: "team_1",
        riskLevel: "medium",
        amountUsd: 100,
    }, { manager: "backup_manager" }), {
        matchedOrgNodeId: "team_1",
        approverChain: ["backup_manager"],
        delegated: true,
    });
    assert.equal(buildGovernanceAuditRecord({
        recordId: "audit_1",
        action: "delegate",
        actorId: "director",
        orgNodeId: "dept_1",
        allowed: true,
        reasonCodes: ["policy.allow"],
        occurredAt: "2026-04-20T00:00:00.000Z",
    }).allowed, true);
    assert.deepEqual(inheritPolicyLayers([
        { policyId: "root", rules: { residency: "cn", retention: 30 } },
        { policyId: "dept", rules: { retention: 7 } },
    ]), { residency: "cn", retention: 7 });
    assert.deepEqual(resolveCompliancePolicyForNode(orgNodes, "team_1", {
        ent_1: [{ policyId: "root", rules: { residency: "cn" } }],
        dept_1: [{ policyId: "dept", rules: { retention: 7 } }],
    }), { residency: "cn", retention: 7 });
    const activeDelegations = listActiveGovernanceDelegations([
        {
            delegationId: "gov_1",
            grantorId: "director",
            granteeId: "manager",
            orgNodeIds: ["dept_1"],
            domainIds: ["platform"],
            permissions: ["manage_approvals"],
            guardrails: [],
            expiresAt: "2026-04-21T00:00:00.000Z",
            revocable: true,
            status: "active",
        },
    ], "2026-04-20T00:00:00.000Z");
    assert.equal(activeDelegations.length, 1);
    assert.equal(matchesGovernanceScope(activeDelegations[0], { orgNodeId: "dept_1", domainId: "platform", capability: "approval.route" }), true);
    assert.equal(redactKnowledgeAccessLog({
        recordId: "log_1",
        requesterId: "user_abcdef",
        boundaryId: "boundary_1",
        purpose: "search",
        allowed: true,
        occurredAt: "2026-04-20T00:00:00.000Z",
    }).requesterId, "redacted:user");
    const boundary = {
        boundaryId: "boundary_1",
        ownerOrgNodeId: "dept_1",
        namespaceIds: ["knowledge.platform"],
        defaultVisibility: "private",
        allowedOrgNodeIds: ["team_1"],
    };
    assert.equal(canAccessKnowledgeBoundary(boundary, "team_1"), true);
    assert.equal(evaluateKnowledgeShare(boundary, "seat_1", [
        {
            grantId: "grant_1",
            boundaryId: "boundary_1",
            requesterOrgNodeId: "seat_1",
            purpose: "incident_review",
            expiresAt: "2026-04-21T00:00:00.000Z",
        },
    ], "2026-04-20T00:00:00.000Z"), true);
    assert.deepEqual(validateOrgHierarchy(orgNodes), []);
    assert.deepEqual(listAncestorNodeIds(orgNodes, "seat_1"), ["team_1", "dept_1", "ent_1"]);
    assert.equal(isLeafOrgNode(orgNodes[3]), true);
    assert.equal(mergeOrgNodes(orgNodes, [{ ...orgNodes[1], displayName: "Platform Org" }]).find((item) => item.orgNodeId === "dept_1")?.displayName, "Platform Org");
    assert.match(buildOidcAuthorizationUrl({
        providerId: "oidc_1",
        issuer: "https://idp.example.com",
        clientId: "client_1",
        redirectUri: "https://app.example.com/callback",
        scopes: ["openid", "profile"],
    }, "state_1"), /authorize/);
    assert.equal(buildSamlAudience({
        providerId: "saml_1",
        entryPoint: "https://idp.example.com/saml",
        issuer: "app.example.com",
        certificateFingerprint: "abc",
    }), "app.example.com:saml_1");
    assert.equal(isTerminalScimAction("user_disabled"), true);
});
//# sourceMappingURL=contract-support.test.js.map