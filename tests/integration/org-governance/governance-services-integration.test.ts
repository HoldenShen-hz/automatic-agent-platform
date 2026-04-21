import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceGovernanceService } from "../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import { DelegatedGovernanceService } from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import { KnowledgeBoundaryService } from "../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import { IdentitySyncService } from "../../../src/org-governance/sso-scim/identity-sync-service.js";

test("integration: org-governance services compose policy, delegation, knowledge boundary, and identity sync", () => {
  const compliance = new ComplianceGovernanceService(
    [
      {
        orgNodeId: "root",
        nodeType: "company",
        displayName: "Root",
        parentOrgNodeId: null,
        ownerUserIds: ["ceo"],
        active: true,
        metadata: {},
        costCenter: "",
      },
      {
        orgNodeId: "dept_finance",
        nodeType: "department",
        displayName: "Finance",
        parentOrgNodeId: "root",
        ownerUserIds: ["finance_director"],
        active: true,
        metadata: {},
        costCenter: "FIN-001",
      },
    ],
    {
      root: [{ policyId: "p_root", rules: { approvalRequired: true } }],
      dept_finance: [{ policyId: "p_finance", rules: { retentionDays: 365 } }],
    },
  );
  const delegated = new DelegatedGovernanceService([
    {
      delegationId: "del_1",
      grantorId: "director",
      granteeId: "manager",
      orgNodeIds: ["dept_finance"],
      domainIds: ["finance"],
      permissions: [],
      guardrails: [],
      expiresAt: "2026-04-21T00:00:00.000Z",
      revocable: true,
      status: "active",
    },
  ]);
  const knowledge = new KnowledgeBoundaryService();
  const identity = new IdentitySyncService();

  const policy = compliance.evaluate({
    actorId: "manager",
    orgNodeId: "dept_finance",
    action: "finance.approve",
    requiredPolicyKeys: ["approvalRequired"],
    occurredAt: "2026-04-20T00:00:00.000Z",
  });
  const delegation = delegated.resolve("manager", {
    orgNodeId: "dept_finance",
    domainId: "finance",
    capability: "approve_budget",
  }, "2026-04-20T00:00:00.000Z");
  const access = knowledge.evaluateAccess(
    {
      boundaryId: "kb_finance",
      ownerOrgNodeId: "dept_finance",
      namespaceIds: ["finance_docs"],
      defaultVisibility: "private",
      allowedOrgNodeIds: [],
    },
    "manager",
    "dept_finance",
    "approve budget",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
  );
  const sync = identity.bootstrap(
    {
      providerId: "oidc_main",
      issuer: "https://id.example.com",
      clientId: "client_1",
      redirectUri: "https://app.example.com/callback",
      scopes: ["openid", "profile"],
    },
    {
      providerId: "saml_main",
      entryPoint: "https://id.example.com/saml",
      issuer: "app.example.com",
      certificateFingerprint: "sha256:abc",
    },
    [{
      eventId: "evt_1",
      action: "user_created",
      subjectId: "manager",
      occurredAt: "2026-04-20T00:00:00.000Z",
    }],
  );

  assert.equal(policy.allowed, true);
  assert.equal(delegation.allowed, true);
  assert.equal(access.allowed, true);
  assert.deepEqual(sync.activeSubjects, ["manager"]);
});
