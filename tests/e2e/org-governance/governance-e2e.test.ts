/**
 * E2E tests for Governance
 * Tests cover end-to-end governance scenarios
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OidcIdentityService } from "../../../src/org-governance/sso-scim/oidc/oidc-service.js";
import { ScimProvisionService } from "../../../src/org-governance/sso-scim/scim-sync/scim-service.js";
import { DelegatedGovernanceService } from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import { GovernanceDelegationRevocationSaga } from "../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";
import { KnowledgeBoundaryService } from "../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import type { OidcProviderConfig } from "../../../src/org-governance/sso-scim/oidc/index.js";
import type { GovernanceDelegation } from "../../../src/org-governance/delegated-governance/delegation-registry/index.js";

function createOidcConfig(): OidcProviderConfig {
  return {
    providerId: "test-provider",
    issuer: "https://idp.example.com",
    clientId: "test-client",
    redirectUri: "https://app.example.com/auth/callback",
    scopes: ["openid", "profile", "email"],
  };
}

function createDelegation(overrides: Partial<{
  delegationId: string;
  grantorId: string;
  granteeId: string;
  permissions: string[];
  orgNodeIds: string[];
  domainIds: string[];
  status: "active" | "revoked" | "expired";
  guardrails: { guardrailId: string; type: string; value: unknown }[];
}> = {}): GovernanceDelegation {
  return {
    delegationId: overrides.delegationId ?? "delegation-1",
    grantorId: overrides.grantorId ?? "platform_team",
    granteeId: overrides.granteeId ?? "division_admin_1",
// @ts-ignore
    permissions: overrides.permissions ?? ["approve_task", "domain_onboarding"],
    orgNodeIds: overrides.orgNodeIds ?? [],
    domainIds: overrides.domainIds ?? [],
    status: overrides.status ?? "active",
// @ts-ignore
    guardrails: overrides.guardrails ?? [],
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("E2E: SSO user authentication and SCIM provisioning flow", async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    // 1. User authenticates via OIDC
    const oidcService = new OidcIdentityService(createOidcConfig());
    const { state } = oidcService.initiateFlow("https://app.example.com/callback");
    const tokens = await oidcService.exchangeCodeForTokens("auth-code-123", state);
    const userInfo = await oidcService.fetchUserInfo(tokens!.accessToken);

    // 2. Create session
    const session = oidcService.createSession(tokens!, userInfo!);
    assert.ok(session.sessionId);
    assert.ok(session.userId);

    // 3. Provision user in SCIM
    const scimService = new ScimProvisionService();
    const scimUser = scimService.createUser({
      userName: userInfo!.preferredUsername ?? userInfo!.email ?? userInfo!.sub,
      displayName: userInfo!.name ?? "Test User",
      emails: userInfo!.email ? [{ value: userInfo!.email, primary: true }] : [],
      active: true,
      groups: [],
      name: {
        formatted: `${userInfo!.givenName ?? ""} ${userInfo!.familyName ?? ""}`.trim(),
        familyName: userInfo!.familyName ?? "",
        givenName: userInfo!.givenName ?? "",
      },
    }, "tenant-1");

    assert.ok(scimUser.id);
    assert.equal(scimUser.userName, userInfo!.preferredUsername ?? userInfo!.email ?? userInfo!.sub);

    // 4. Verify session is valid
    const validatedSession = oidcService.validateAccessToken(tokens!.accessToken);
    assert.ok(validatedSession);
    assert.equal(validatedSession!.userId, userInfo!.sub);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("E2E: Delegation grant, usage, and revocation flow", () => {
  // 1. Platform team grants delegation to division admin
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "delegation-1",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["manage_approvals", "manage_budgets"],
      guardrails: [
        { guardrailId: "max_budget", type: "max_budget", value: 5000 },
      ],
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // 2. Division admin uses delegation
  const resolveResult = governanceService.resolve("division_admin_1", {
    orgNodeId: "dept-finance",
// @ts-ignore
    permission: "manage_approvals",
  });
  assert.equal(resolveResult.allowed, true);

  // 3. Division admin attempts to exceed budget guardrail
  const guardrailResult = governanceService.checkOperation(
    { actorId: "division_admin_1", actorRole: "division_admin", orgNodeId: "dept-finance" },
    "approve_budget_increase",
    10000, // Exceeds 5000 limit
  );
  assert.equal(guardrailResult.allowed, false);

  // 4. Within budget
  const withinBudgetResult = governanceService.checkOperation(
    { actorId: "division_admin_1", actorRole: "division_admin", orgNodeId: "dept-finance" },
    "approve_budget_increase",
    3000, // Within 5000 limit
  );
  assert.equal(withinBudgetResult.allowed, true);

  // 5. Revoke delegation
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
// @ts-ignore
    revokePendingApprovals: () => {},
    revokeActiveSessions: () => {},
    compensateResource: () => {},
    audit: () => {},
  });

  const receipt = saga.revoke({
    delegationId: "delegation-1",
    requestedAtMs: Date.now(),
    derivedResourceIds: ["pending-approval-1", "active-session-1"],
    derivedDelegationIds: [],
  }, Date.now());

  assert.equal(receipt.status, "completed");
  assert.ok(receipt.frozenResourceIds.includes("pending-approval-1"));
  assert.ok(receipt.sagaStages.includes("prepare"));
});

test("E2E: Knowledge boundary access with delegation and revocation", () => {
  // 1. Set up knowledge boundary
  const boundaryService = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_finance_reports",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: ["finance"],
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: ["dept_audit"],
  };

  // 2. Finance user (owner) grants access to HR for specific purpose
  const grants = [
    {
      grantId: "grant_hr_audit",
      boundaryId: "kb_finance_reports",
      requesterOrgNodeId: "dept_hr",
      purpose: "annual_audit",
      expiresAt: "2026-12-31T23:59:59.999Z",
    },
  ];

  // 3. HR user tries to access finance boundary (not owner, not allowed org)
  const hrAccessDecision = boundaryService.evaluateAccess(
// @ts-ignore
    boundary,
    "user_hr",
    "dept_hr",
    "annual_audit",
    grants,
    undefined,
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(hrAccessDecision.allowed, true); // Has valid grant

  // 4. User from unauthorized department tries to access
  const unauthorizedDecision = boundaryService.evaluateAccess(
// @ts-ignore
    boundary,
    "user_sales",
    "dept_sales",
    "review",
    [], // No grant
    undefined,
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(unauthorizedDecision.allowed, false);

  // 5. Dynamic policy blocks specific user
  const blockedUserDecision = boundaryService.evaluateDynamicAccess({
// @ts-ignore
    boundary,
    requesterId: "blocked_user",
    requesterOrgNodeId: "dept_hr",
    purpose: "annual_audit",
    grants,
    dynamicPolicy: {
      policyId: "block-internal-audit",
      blockedRequesterIds: ["blocked_user"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });
  assert.equal(blockedUserDecision.allowed, false);
});

test("E2E: Multi-level delegation with inheritance and revocation", () => {
  // 1. Platform team delegates to Division Admin
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "del-platform-to-division",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["manage_approvals", "manage_budgets", "manage_domains"],
      guardrails: [
        { guardrailId: "max_budget", type: "max_budget", value: 10000 },
        { guardrailId: "max_risk", type: "max_risk_level", value: "high" },
      ],
    }),
    // 2. Division Admin delegates to Department Admin
    createDelegation({
      delegationId: "del-division-to-dept",
      grantorId: "division_admin_1",
      granteeId: "department_admin_1",
      permissions: ["manage_approvals", "manage_triggers"],
      guardrails: [],
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // 3. Division Admin uses their permissions
  const divisionResult = governanceService.resolve("division_admin_1", {
    orgNodeId: "dept-1",
// @ts-ignore
    permission: "manage_budgets",
  });
  assert.equal(divisionResult.allowed, true);

  // 4. Department Admin uses inherited permissions
  const deptResult = governanceService.resolve("department_admin_1", {
    orgNodeId: "dept-1",
// @ts-ignore
    permission: "manage_approvals",
  });
  assert.equal(deptResult.allowed, true);

  // 5. Validate inheritance rules
  const tightenResult = governanceService.validateInheritanceRule(
    "platform_team",
    "division_admin",
    "tighten",
  );
  assert.equal(tightenResult.allowed, true);

  // 6. Revoke with cascade - revoke platform->division should cascade to division->dept
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
    revokeDerivedDelegation: (delegationId) => {},
    audit: () => {},
  });

  const receipt = saga.revoke({
    delegationId: "del-platform-to-division",
    requestedAtMs: Date.now(),
    derivedResourceIds: ["resource-1"],
    derivedDelegationIds: ["del-division-to-dept"], // Child delegation
  }, Date.now());

  assert.equal(receipt.status, "completed");
  assert.ok(receipt.revokedDerivedDelegationIds.includes("del-division-to-dept"));
});

test("E2E: Full user lifecycle with SSO, SCIM, and Governance", async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    // 1. SSO Authentication
    const oidcService = new OidcIdentityService(createOidcConfig());
    const { state } = oidcService.initiateFlow("https://app.example.com/callback");
    const tokens = await oidcService.exchangeCodeForTokens("auth-code", state);
    const userInfo = await oidcService.fetchUserInfo(tokens!.accessToken);
    const session = oidcService.createSession(tokens!, userInfo!);

    // 2. SCIM Provisioning
    const scimService = new ScimProvisionService();
    const scimUser = scimService.createUser({
      userName: userInfo!.preferredUsername ?? userInfo!.email ?? userInfo!.sub,
      displayName: userInfo!.name ?? "Test User",
      emails: userInfo!.email ? [{ value: userInfo!.email, primary: true }] : [],
      active: true,
      groups: [],
      name: {
        formatted: `${userInfo!.givenName ?? ""} ${userInfo!.familyName ?? ""}`.trim(),
        familyName: userInfo!.familyName ?? "",
        givenName: userInfo!.givenName ?? "",
      },
    }, "tenant-1");

    // 3. Create delegation for the user
    const delegations: GovernanceDelegation[] = [
      createDelegation({
        delegationId: "del-1",
        grantorId: "platform_team",
        granteeId: scimUser.id,
        permissions: ["manage_approvals", "manage_triggers"],
        guardrails: [],
      }),
    ];

    const governanceService = new DelegatedGovernanceService(delegations);

    // 4. User exercises governance permissions
    const governanceResult = governanceService.resolve(scimUser.id, {
      orgNodeId: "dept-1",
// @ts-ignore
      permission: "manage_approvals",
    });
    assert.equal(governanceResult.allowed, true);

    // 5. Refresh token
    const newTokens = await oidcService.refreshAccessToken(session.sessionId);
    assert.ok(newTokens);

    // 6. Session management - revoke all sessions (e.g., user logout everywhere)
    const revokedCount = oidcService.revokeAllUserSessions(userInfo!.sub);
    assert.equal(revokedCount, 1);

    // 7. Knowledge boundary access check
    const boundaryService = new KnowledgeBoundaryService();
    const boundary = {
      boundaryId: "kb_user_private",
      ownerOrgNodeId: "dept_hr",
      namespaceIds: [],
      defaultVisibility: "private" as const,
      allowedOrgNodeIds: [],
    };

    const accessResult = boundaryService.evaluateAccess(
// @ts-ignore
      boundary,
      userInfo!.sub,
      "dept_hr",
      "personal_data_access",
      [],
      undefined,
      "2026-04-20T00:00:00.000Z",
    );
    assert.equal(accessResult.allowed, true); // Owner access

  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("E2E: Compliance policy resolution with delegation guardrails", () => {
  // 1. Set up delegations with guardrails
  const delegations: GovernanceDelegation[] = [
    createDelegation({
      delegationId: "del-compliance-1",
      grantorId: "platform_team",
      granteeId: "division_admin_1",
      permissions: ["manage_approvals", "manage_budgets"],
      guardrails: [
        { guardrailId: "max_budget", type: "max_budget", value: 5000 },
        { guardrailId: "max_risk", type: "max_risk_level", value: "high" },
        { guardrailId: "forbidden_tools", type: "forbidden_tools", value: ["exec", "delete_all"] },
      ],
    }),
  ];

  const governanceService = new DelegatedGovernanceService(delegations);

  // 2. Get applicable guardrails for a scope
  const guardrails = governanceService.getApplicableGuardrails("dept-finance", "finance");
  assert.ok(guardrails.length > 0);
  assert.ok(guardrails.some(g => g.guardrailId === "max_budget"));

  // 3. Check operation with multiple guardrails
  const passResult = governanceService.checkOperation(
    { actorId: "division_admin_1", actorRole: "division_admin", orgNodeId: "dept-finance", domainId: "finance" },
    "approve_budget_increase",
    3000,
  );
  assert.equal(passResult.allowed, true);

  const failBudgetResult = governanceService.checkOperation(
    { actorId: "division_admin_1", actorRole: "division_admin", orgNodeId: "dept-finance", domainId: "finance" },
    "approve_budget_increase",
    8000,
  );
  assert.equal(failBudgetResult.allowed, false);

  const failRiskResult = governanceService.checkOperation(
    { actorId: "division_admin_1", actorRole: "division_admin", orgNodeId: "dept-finance", domainId: "finance" },
    "approve_task",
    "critical",
  );
  assert.equal(failRiskResult.allowed, false);

  // 4. Revoke delegation with SLO tracking
  const saga = new GovernanceDelegationRevocationSaga({
    freezeResource: () => {},
// @ts-ignore
    revokePendingApprovals: () => {},
    revokeActiveSessions: () => {},
    audit: () => {},
  });

  const receipt = saga.revoke({
    delegationId: "del-compliance-1",
    requestedAtMs: Date.now(),
    derivedResourceIds: ["resource-1", "resource-2", "resource-3"],
    derivedDelegationIds: [],
  }, Date.now());

  assert.equal(receipt.status, "completed");
  assert.ok(receipt.revokeWithinSlo); // Should complete within 60s
  assert.equal(receipt.cascadeWithinSlo, false);
});

test("E2E: Chinese wall policy with knowledge boundary access", () => {
  // 1. Set up Chinese wall policy to prevent conflicts
  const boundaryService = new KnowledgeBoundaryService();
  const chineseWallPolicy = {
    policyId: "cwp_finance_legal",
    conflictGroups: {
      "group_finance_legal": ["dept_finance", "dept_legal"],
    },
  };

  // 2. Finance boundary
  const financeBoundary = {
    boundaryId: "kb_finance_reports",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: [],
  };

  // 3. Legal user tries to access finance boundary - should be blocked by chinese wall
  const legalAccessDecision = boundaryService.evaluateAccess(
// @ts-ignore
    financeBoundary,
    "user_legal",
    "dept_legal",
    "review",
    [],
    chineseWallPolicy,
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(legalAccessDecision.allowed, false);
  assert.ok(legalAccessDecision.reasonCodes.includes("knowledge_boundary.chinese_wall_blocked"));

  // 4. Finance user can access their own boundary
  const financeAccessDecision = boundaryService.evaluateAccess(
// @ts-ignore
    financeBoundary,
    "user_finance",
    "dept_finance",
    "manage",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(financeAccessDecision.allowed, true);

  // 5. Audit team (allowed org) can access with grant
  const grants = [
    {
      grantId: "grant_audit",
      boundaryId: "kb_finance_reports",
      requesterOrgNodeId: "dept_audit",
      purpose: "audit",
      expiresAt: "2026-12-31T23:59:59.999Z",
    },
  ];

  const auditAccessDecision = boundaryService.evaluateAccess(
// @ts-ignore
    financeBoundary,
    "user_audit",
    "dept_audit",
    "audit",
    grants,
    undefined,
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(auditAccessDecision.allowed, true);
});
