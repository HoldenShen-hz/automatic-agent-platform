import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DomainManifestSchema } from "../../../src/domains/registry/domain-model.js";
import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";
import { DomainRecipeSchema, type DomainRecipe } from "../../../src/domains/recipes/index.js";
import { RecipeExecutor } from "../../../src/domains/recipes/recipe-executor.js";
import { ApprovalRoutingService } from "../../../src/org-governance/approval-routing/approval-routing-service.js";
import { resolveAmountRoute } from "../../../src/org-governance/approval-routing/route-engine/index.js";
import { resolveCompliancePolicyForNode } from "../../../src/org-governance/compliance-engine/policy-resolver/index.js";
import { DelegatedGovernanceService } from "../../../src/org-governance/delegated-governance/delegated-governance-service.js";
import { GovernanceDelegationRevocationSaga } from "../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";
import { KnowledgeBoundaryService } from "../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import { evaluateKnowledgeShare } from "../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";
import { OidcIdentityService } from "../../../src/org-governance/sso-scim/oidc/oidc-service.js";
import { ScimProvisionService } from "../../../src/org-governance/sso-scim/scim-sync/scim-service.js";

function createOidcConfig() {
  return {
    providerId: "oidc-provider",
    issuer: "https://issuer.example.com",
    clientId: "client-1",
    clientSecret: "client-secret",
    redirectUri: "https://app.example.com/callback",
    scopes: ["openid", "profile", "email"],
  };
}

function createDomainDefinition(domainId: string, status: "draft" | "registered" | "canary" | "active" | "deprecated" = "registered") {
  return {
    domainId,
    name: `Domain ${domainId}`,
    description: `Test domain ${domainId}`,
    version: 1,
    workflows: [
      {
        workflowId: `${domainId}.main`,
        name: "Main Workflow",
        triggerConditions: {},
        steps: [{ stepName: "step-1", dependsOn: [], timeoutMs: 60000, toolHints: [], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false }],
      },
    ],
    toolBundles: [
      {
        bundleId: `${domainId}.tools`,
        tools: [{ toolName: "read", enabled: true, configOverrides: {} }],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["analysis"],
      requiredTools: ["read"],
      optionalTools: [],
      modelPreferences: {},
      budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: 5 },
      securityLevel: "standard",
    },
    status,
    externalAdapters: [],
    pluginBindings: [],
  } as const;
}

function createRecipe(overrides: Partial<DomainRecipe> & { recipeId: string; defaultWorkflowId: string }): DomainRecipe {
  return DomainRecipeSchema.parse({
    recipeId: overrides.recipeId,
    domainId: overrides.domainId ?? "domain-1",
    name: overrides.name ?? `Recipe ${overrides.recipeId}`,
    description: overrides.description ?? "Test recipe",
    triggerPhrases: overrides.triggerPhrases ?? ["run recipe"],
    archetype: overrides.archetype ?? "crud_heavy",
    defaultWorkflowId: overrides.defaultWorkflowId,
    defaultToolBundleIds: overrides.defaultToolBundleIds ?? ["bundle-1"],
  });
}

test("1969..1973: OIDC PKCE, userinfo fail-closed, refresh rotation, SCIM tenant isolation, and share expiry checks stay fixed", async () => {
  const oidcSource = readFileSync("src/org-governance/sso-scim/oidc/oidc-service.ts", "utf8");
  const shareSource = readFileSync("src/org-governance/knowledge-boundary/sharing-gate/index.ts", "utf8");
  const originalFetch = globalThis.fetch;

  try {
    let tokenRequestBody = "";
    globalThis.fetch = (async (_input, init) => {
      tokenRequestBody = String(init?.body ?? "");
      return {
        ok: true,
        json: async () => ({
          access_token: "provider-access-token",
          id_token: "provider-id-token",
          refresh_token: "provider-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      };
    }) as typeof fetch;

    const pkceService = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: false });
    const flow = pkceService.initiateFlow("https://app.example.com/callback");

    assert.match(flow.authorizationUrl, /code_challenge=/);
    assert.match(flow.authorizationUrl, /code_challenge_method=S256/);
    assert.ok(!flow.authorizationUrl.includes(flow.codeVerifier));

    const exchanged = await pkceService.exchangeCodeForTokens("auth-code-1", flow.state);
    assert.ok(exchanged);
    assert.match(tokenRequestBody, /grant_type=authorization_code/);
    assert.match(tokenRequestBody, new RegExp(`code_verifier=${encodeURIComponent(flow.codeVerifier)}`));
    assert.match(oidcSource, /generateCodeVerifier/);
    assert.match(oidcSource, /deriveCodeChallenge/);

    globalThis.fetch = (async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as typeof fetch;
    const failClosedService = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: false });
    await assert.rejects(
      async () => failClosedService.fetchUserInfo("access-token-1"),
      /oidc\.userinfo_fetch_failed:503/,
    );

    const rotationService = new OidcIdentityService(createOidcConfig());
    const { state } = rotationService.initiateFlow("https://app.example.com/callback");
    const tokens = await rotationService.exchangeCodeForTokens("auth-code-2", state);
    const session = rotationService.createSession(tokens!, { sub: "user-1", email: "user-1@example.com" });
    const refreshed1 = await rotationService.refreshAccessToken(session.sessionId);
    const refreshed2 = await rotationService.refreshAccessToken(session.sessionId);

    assert.ok(refreshed1?.refreshToken);
    assert.ok(refreshed2?.refreshToken);
    assert.notEqual(refreshed1?.refreshToken, tokens?.refreshToken);
    assert.notEqual(refreshed2?.refreshToken, refreshed1?.refreshToken);
    assert.match(oidcSource, /refreshTokenFamilies/);
    assert.match(oidcSource, /this\.refreshTokenFamilies\.delete/);
    assert.match(oidcSource, /this\.refreshTokenFamilies\.set/);

    const scim = new ScimProvisionService();
    const tenant1User = scim.createUser({
      userName: "admin",
      displayName: "Tenant One Admin",
      emails: [{ value: "admin@example.com", primary: true }],
      active: true,
      groups: [],
      name: { formatted: "Tenant One Admin", familyName: "Admin", givenName: "TenantOne" },
    }, "tenant-1");
    scim.createUser({
      userName: "admin",
      displayName: "Tenant Two Admin",
      emails: [{ value: "admin@example.com", primary: true }],
      active: true,
      groups: [],
      name: { formatted: "Tenant Two Admin", familyName: "Admin", givenName: "TenantTwo" },
    }, "tenant-2");

    assert.equal(scim.getUser(tenant1User.id, "tenant-2"), null);
    assert.equal(scim.getUserByUsername("admin", "tenant-1")?.tenantId, "tenant-1");
    assert.equal(scim.getUserByUsername("admin", "tenant-2")?.tenantId, "tenant-2");
    assert.equal(scim.getUserByEmail("admin@example.com", "tenant-3"), null);
    assert.equal(scim.listUsers({ tenantId: "tenant-2" }).Resources.length, 1);

    const shareDecision = evaluateKnowledgeShare(
      {
        boundaryId: "boundary-1",
        ownerOrgNodeId: "dept-finance",
        namespaceIds: [],
        auditOnAccess: true,
        defaultVisibility: "private",
        allowedOrgNodeIds: [],
        fieldAllowlist: [],
      },
      "dept-hr",
      [{
        grantId: "grant-1",
        boundaryId: "boundary-1",
        requesterOrgNodeId: "dept-hr",
        purpose: "analysis",
        expiresAt: "2026-05-11T18:00:00-08:00",
      }],
      "2026-05-12T01:00:00.000Z",
    );
    assert.equal(shareDecision.allowed, true);
    assert.match(shareSource, /new Date\(item\.expiresAt\) >= new Date\(nowIso\)/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("1974..1981: domain lifecycle, quotas, delegation intersection, threshold routing, audit ids, deny-by-default, and revocation SLO stay fixed", () => {
  const registry = new DomainRegistryService();
  registry.register(createDomainDefinition("domain-canary", "registered"));
  assert.equal(registry.promoteToCanary("domain-canary").status, "canary");
  assert.equal(registry.activate("domain-canary").status, "active");

  registry.register(createDomainDefinition("domain-archive", "active"));
  assert.equal(registry.deprecate("domain-archive").status, "deprecated");
  assert.equal(registry.archive("domain-archive").status, "archived");

  const manifest = DomainManifestSchema.parse({
    domainId: "manifest-1",
    name: "Manifest One",
    description: "Manifest with quotas",
    version: "1.0.0",
    owner: "platform-team",
    lifecycleState: "active",
    capabilityIds: [],
    requiredPlugins: [],
    securityLevel: "standard",
    trustTier: "internal",
    publicSdkSurface: "full",
    settingsSchema: {},
    tags: [],
    resourceQuotas: {
      cpuLimit: 4,
      memoryLimit: 8192,
      concurrencyLimit: 16,
      timeoutMs: 300000,
    },
  });
  assert.equal(manifest.resourceQuotas.cpuLimit, 4);
  assert.equal(manifest.resourceQuotas.memoryLimit, 8192);
  assert.equal(manifest.resourceQuotas.concurrencyLimit, 16);
  assert.equal(manifest.resourceQuotas.timeoutMs, 300000);

  const governance = new DelegatedGovernanceService([{
    delegationId: "delegation-1",
    grantorId: "grantor-1",
    granteeId: "grantee-1",
    level: "admin",
    delegatable: false,
    orgNodeIds: ["org-1"],
    domainIds: ["domain-1"],
    derivedDelegationIds: [],
    permissions: ["manage_domains"],
    guardrails: [],
    expiresAt: "2030-01-01T00:00:00.000Z",
    revocable: true,
    status: "active",
  }]);
  const deniedByIntersection = governance.resolve(
    "grantee-1",
    { orgNodeId: "org-1", domainId: "domain-1", permission: "manage_domains" },
    "2026-05-12T00:00:00.000Z",
    ["view_audit"],
  );
  assert.equal(deniedByIntersection.allowed, false);
  assert.deepEqual(deniedByIntersection.reasonCodes, ["delegated_governance.permission_exceeds_grantor_authority"]);

  const nodes = [
    {
      orgNodeId: "company-1",
      nodeType: "company",
      displayName: "Company",
      parentOrgNodeId: null,
      ownerUserIds: ["ceo"],
      active: true,
      costCenter: "CC-0",
      metadata: {},
    },
    {
      orgNodeId: "dept-1",
      nodeType: "department",
      displayName: "Department",
      parentOrgNodeId: "company-1",
      ownerUserIds: ["approver-1"],
      active: true,
      costCenter: "CC-1",
      metadata: {},
    },
  ] as const;

  const equalThresholdNode = resolveAmountRoute(nodes, {
    requesterId: "requester-1",
    orgNodeId: "dept-1",
    riskLevel: "medium",
    amountUsd: 1000,
  }, [{ maxAmountUsd: 1000, targetNodeTypes: ["department"] }]);
  assert.equal(equalThresholdNode?.orgNodeId, "dept-1");

  const routingService = new ApprovalRoutingService({ orgNodes: nodes });
  const route1 = routingService.route(
    { requesterId: "requester-1", orgNodeId: "dept-1", riskLevel: "medium" },
    "2026-05-12T00:00:00.000Z",
    "2026-05-12T00:00:00.000Z",
  );
  const route2 = routingService.route(
    { requesterId: "requester-1", orgNodeId: "dept-1", riskLevel: "medium" },
    "2026-05-12T00:00:00.000Z",
    "2026-05-12T00:00:00.000Z",
  );
  assert.notEqual(route1.auditRecord.recordId, route2.auditRecord.recordId);
  assert.match(route1.auditRecord.recordId, /approval_route_audit_requester-1_dept-1_\d+_/);

  const policyResult = resolveCompliancePolicyForNode(
    [{ orgNodeId: "team-1", parentOrgNodeId: null, active: true, nodeType: "team" }],
    "team-1",
    {},
  );
  assert.equal(policyResult.denyByDefault, true);
  assert.equal(policyResult.policy["_denyByDefault"], true);

  const revocation = new GovernanceDelegationRevocationSaga({
    revokeDerivedDelegation: () => {
      throw new Error("commit.failed");
    },
  });
  const receipt = revocation.revoke({
    delegationId: "delegation-2",
    requestedAtMs: 0,
    derivedResourceIds: [],
    derivedDelegationIds: ["child-1"],
  }, 30_000);
  assert.equal(receipt.failedStage, "commit");
  assert.equal(receipt.cascadeWithinSlo, false);
});

test("1982..1986: expired OIDC cleanup, recipe workflow query, targeted SCIM patch removal, required grant logic, and SCIM attribute-aware filtering stay fixed", async () => {
  const cleanupService = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: true });
  cleanupService.createSession({
    accessToken: "expired-access-token",
    idToken: "expired-id-token",
    refreshToken: "expired-refresh-token",
    expiresIn: -1,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() - 1).toISOString(),
  }, {
    sub: "expired-user",
    email: "expired@example.com",
  });
  assert.equal(cleanupService.cleanupExpiredSessions(), 1);
  assert.equal(cleanupService.validateAccessToken("expired-access-token"), null);

  const workflowCalls: Array<{ workflowId: string; tenantId?: string | null }> = [];
  const executor = new RecipeExecutor(null, undefined, {
    existsWorkflow(workflowId, tenantId) {
      workflowCalls.push({ workflowId, tenantId });
      return workflowId === "wf-available";
    },
  });
  const success = await executor.execute(
    createRecipe({ recipeId: "recipe-success", defaultWorkflowId: "wf-available" }),
    { executionId: "exec-1", taskId: "task-1", tenantId: "tenant-1", correlationId: "corr-1", input: "run" },
  );
  const failure = await executor.execute(
    createRecipe({ recipeId: "recipe-failure", defaultWorkflowId: "wf-missing" }),
    { executionId: "exec-2", taskId: "task-2", tenantId: "tenant-1", correlationId: "corr-2", input: "run" },
  );
  assert.equal(success.success, true);
  assert.equal(failure.success, false);
  assert.deepEqual(workflowCalls.map((item) => item.workflowId), ["wf-available", "wf-missing"]);

  const scim = new ScimProvisionService();
  const user1 = scim.createUser({
    userName: "engineering.user",
    displayName: "John Smith",
    emails: [{ value: "john@example.com", primary: true }],
    active: true,
    groups: [],
    name: { formatted: "John Smith", familyName: "Smith", givenName: "John" },
  }, "tenant-1");
  const user2 = scim.createUser({
    userName: "jane.doe",
    displayName: "Engineering Lead",
    emails: [{ value: "jane@example.com", primary: true }],
    active: true,
    groups: [],
    name: { formatted: "Engineering Lead", familyName: "Doe", givenName: "Jane" },
  }, "tenant-1");
  const group = scim.createGroup({ displayName: "Engineering", members: [] }, "tenant-1");
  scim.addMemberToGroup(group.id, user1.id, "tenant-1");
  scim.addMemberToGroup(group.id, user2.id, "tenant-1");

  const patched = scim.patchGroup(group.id, [
    { op: "remove", path: `members[value eq "${user1.id}"]` },
  ], "tenant-1");
  assert.equal(patched?.members.length, 1);
  assert.equal(patched?.members[0]?.value, user2.id);

  const filterResult = scim.listUsers({ tenantId: "tenant-1", filter: "displayName co \"Engineering\"" });
  assert.equal(filterResult.totalResults, 1);
  assert.equal(filterResult.Resources[0]?.userName, "jane.doe");

  const knowledgeService = new KnowledgeBoundaryService();
  const decision = knowledgeService.evaluateDynamicAccess({
    boundary: {
      boundaryId: "kb-1",
      ownerOrgNodeId: "dept-finance",
      namespaceIds: [],
      auditOnAccess: true,
      defaultVisibility: "private",
      allowedOrgNodeIds: ["dept-hr"],
      fieldAllowlist: [],
    },
    requesterId: "user-1",
    requesterOrgNodeId: "dept-hr",
    purpose: "analysis",
    grants: [{
      grantId: "grant-1",
      boundaryId: "boundary-prereq",
      requesterOrgNodeId: "dept-hr",
      purpose: "analysis",
      expiresAt: "2026-06-01T00:00:00.000Z",
    }],
    dynamicPolicy: {
      policyId: "policy-1",
      requiredGrantBoundaryIds: ["boundary-prereq"],
    },
    occurredAt: "2026-05-12T00:00:00.000Z",
  });
  assert.equal(decision.allowed, true);
});

test("1987..1988: risk and dev security configs stay aligned with the audited guardrails", () => {
  const riskConfig = JSON.parse(readFileSync("config/risk/default.json", "utf8")) as {
    factorWeights: Record<string, number>;
  };
  const devSecurityConfig = JSON.parse(readFileSync("config/security/dev.json", "utf8")) as {
    approvalMode: string;
  };

  assert.equal(Object.keys(riskConfig.factorWeights).length, 8);
  assert.deepEqual(
    Object.keys(riskConfig.factorWeights),
    [
      "impact",
      "irreversibility",
      "dataSensitivity",
      "autonomyModeRisk",
      "tenantImpact",
      "blastRadius",
      "historicalFailureRate",
      "evidenceConfidence",
    ],
  );
  assert.equal(devSecurityConfig.approvalMode, "supervised");
});
