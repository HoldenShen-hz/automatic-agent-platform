import assert from "node:assert/strict";
import test from "node:test";

import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { createSeededApiContext } from "../../../../helpers/api.js";

// Re-export barrel exports from index.ts
import * as ApiModule from "../../../../../src/platform/interface/api/index.js";

// Test the barrel file exports
test("api barrel exports AdminConfigService", () => {
  assert.ok(ApiModule.AdminConfigService !== undefined);
  assert.equal(typeof ApiModule.AdminConfigService, "function");
});

test("api barrel exports ApiAuthService", () => {
  assert.ok(ApiModule.ApiAuthService !== undefined);
  assert.equal(typeof ApiModule.ApiAuthService, "function");
});

test("api barrel exports CostReportService", () => {
  assert.ok(ApiModule.CostReportService !== undefined);
  assert.equal(typeof ApiModule.CostReportService, "function");
});

test("api barrel exports PackCatalogService", () => {
  assert.ok(ApiModule.PackCatalogService !== undefined);
  assert.equal(typeof ApiModule.PackCatalogService, "function");
});

test("api barrel exports GraphQLAdapterService", () => {
  assert.ok(ApiModule.GraphQLAdapterService !== undefined);
  assert.equal(typeof ApiModule.GraphQLAdapterService, "function");
});

test("api barrel exports GrpcAdapterService", () => {
  assert.ok(ApiModule.GrpcAdapterService !== undefined);
  assert.equal(typeof ApiModule.GrpcAdapterService, "function");
});

test("api barrel exports FederationRoutingService", () => {
  assert.ok(ApiModule.FederationRoutingService !== undefined);
  assert.equal(typeof ApiModule.FederationRoutingService, "function");
});

test("api barrel exports TaskWebSocketStatusRelay", () => {
  assert.ok(ApiModule.TaskWebSocketStatusRelay !== undefined);
  assert.equal(typeof ApiModule.TaskWebSocketStatusRelay, "function");
});

test("api barrel exports MissionControlService", () => {
  assert.ok(ApiModule.MissionControlService !== undefined);
  assert.equal(typeof ApiModule.MissionControlService, "function");
});

test("api barrel exports HttpApiServer", () => {
  assert.ok(ApiModule.HttpApiServer !== undefined);
  assert.equal(typeof ApiModule.HttpApiServer, "function");
});

test("api barrel exports OidcOAuthService", () => {
  assert.ok(ApiModule.OidcOAuthService !== undefined);
  assert.equal(typeof ApiModule.OidcOAuthService, "function");
});

test("api barrel exports OpenapiDocument types and functions", () => {
  assert.ok(ApiModule.buildOpenApiDocument !== undefined);
  assert.ok(ApiModule.listApiRoutes !== undefined);
});

test("api barrel exports facade-interfaces types", () => {
  assert.ok(ApiModule.createNoOpIncidentFacadeService !== undefined);
});

test("api barrel task websocket status relay integration", () => {
  const relay = new ApiModule.TaskWebSocketStatusRelay(
    {
      broadcastTaskEvent() {
        // noop
      },
    } as never,
    {
      event: {
        listEventsByType() {
          return [];
        },
      },
    } as never,
    { backlogLimit: 10 },
  );

  // Should not throw
  relay.pollOnce();
  assert.ok(true, "TaskWebSocketStatusRelay pollOnce should not throw when no events");
});

test("api barrel pack catalog service create and get pack", () => {
  const service = new ApiModule.PackCatalogService();
  const entry = service.createPack({
    packId: "test_pack",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "test_domain",
    createdBy: "test_user",
  });

  assert.equal(entry.packId, "test_pack");
  assert.equal(entry.name, "Test Pack");
  assert.equal(entry.lifecycleStage, "draft");

  const retrieved = service.getPack("test_pack");
  assert.ok(retrieved !== null);
  assert.equal(retrieved?.packId, "test_pack");

  const notFound = service.getPack("nonexistent");
  assert.equal(notFound, null);
});

test("api barrel cost report service create and list reports", () => {
  const service = new ApiModule.CostReportService();
  const report = service.createReport({
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 100.0,
    resourceCosts: [],
    submittedBy: "test_user",
  });

  assert.ok(report.reportId.startsWith("cost_report_"));
  assert.equal(report.totalCostUsd, 100.0);

  const reports = service.listReports();
  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.reportId, report.reportId);
});

test("api barrel admin config service apply update", () => {
  const service = new ApiModule.AdminConfigService();
  const record = service.applyUpdate({
    key: "test.config.key",
    value: { enabled: true },
    updatedBy: "admin",
  });

  assert.ok(record.updateId.startsWith("config_update_"));
  assert.equal(record.key, "test.config.key");
  assert.deepEqual(record.value, { enabled: true });

  const updates = service.listUpdates();
  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.key, "test.config.key");
});

test("api barrel graphql adapter service basic operations", () => {
  const adapter = new ApiModule.GraphQLAdapterService({
    endpoint: "http://localhost:4000/graphql",
    introspectionEnabled: true,
    playgroundEnabled: false,
  });

  assert.equal(adapter.isAvailable(), true);

  const config = adapter.getConfig();
  assert.equal(config.endpoint, "http://localhost:4000/graphql");
  assert.equal(config.introspectionEnabled, true);
});

test("api barrel grpc adapter service basic operations", () => {
  const adapter = new ApiModule.GrpcAdapterService({
    host: "localhost",
    port: 50051,
    packageName: "test.package",
    serviceName: "TestService",
  });

  assert.equal(adapter.isAvailable(), true);
  assert.equal(adapter.getServerAddress(), "localhost:50051");

  const config = adapter.getConfig();
  assert.equal(config.host, "localhost");
  assert.equal(config.port, 50051);
});

test("api barrel federation routing service register and route", () => {
  const service = new ApiModule.FederationRoutingService();

  service.registerPartner({
    partnerId: "test_partner",
    partnerName: "Test Partner",
    endpoint: "https://api.test.example.com",
    capabilities: ["task_management"],
    status: "active",
    metadata: {},
    retryPolicy: { maxRetries: 3, timeoutMs: 30000 },
  });

  const partner = service.getPartner("test_partner");
  assert.ok(partner !== undefined);
  assert.equal(partner?.partnerName, "Test Partner");

  const decision = service.route({
    partnerId: "test_partner",
    path: "/tasks",
    method: "GET",
  });

  assert.equal(decision.allowed, true);
  assert.ok(decision.targetUrl?.includes("api.test.example.com"));
});

test("api barrel federation routing service blocks inactive partner", () => {
  const service = new ApiModule.FederationRoutingService();

  service.registerPartner({
    partnerId: "inactive_partner",
    partnerName: "Inactive Partner",
    endpoint: "https://api.inactive.example.com",
    capabilities: [],
    status: "inactive",
    metadata: {},
    retryPolicy: { maxRetries: 3, timeoutMs: 30000 },
  });

  const decision = service.route({
    partnerId: "inactive_partner",
    path: "/tasks",
    method: "GET",
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reason?.includes("inactive"));
});

test("api barrel federation routing service handles unknown partner", () => {
  const service = new ApiModule.FederationRoutingService();

  const decision = service.route({
    partnerId: "unknown_partner",
    path: "/tasks",
    method: "GET",
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reason?.includes("not found"));
});

test("api barrel federation routing service capability check", () => {
  const service = new ApiModule.FederationRoutingService();

  service.registerPartner({
    partnerId: "capable_partner",
    partnerName: "Capable Partner",
    endpoint: "https://api.capable.example.com",
    capabilities: ["task_management", "reporting"],
    status: "active",
    metadata: {},
    retryPolicy: { maxRetries: 3, timeoutMs: 30000 },
  });

  assert.equal(service.partnerSupportsCapability("capable_partner", "task_management"), true);
  assert.equal(service.partnerSupportsCapability("capable_partner", "analytics"), false);
  assert.equal(service.partnerSupportsCapability("unknown_partner", "task_management"), false);
});

test("api barrel federation routing service list active partners", () => {
  const service = new ApiModule.FederationRoutingService();

  service.registerPartner({
    partnerId: "active_1",
    partnerName: "Active 1",
    endpoint: "https://api.active1.example.com",
    capabilities: [],
    status: "active",
    metadata: {},
    retryPolicy: { maxRetries: 3, timeoutMs: 30000 },
  });

  service.registerPartner({
    partnerId: "inactive_1",
    partnerName: "Inactive 1",
    endpoint: "https://api.inactive1.example.com",
    capabilities: [],
    status: "inactive",
    metadata: {},
    retryPolicy: { maxRetries: 3, timeoutMs: 30000 },
  });

  const activePartners = service.listActivePartners();
  assert.equal(activePartners.length, 1);
  assert.equal(activePartners[0]?.partnerId, "active_1");
});

test("api barrel openapi document buildOpenApiDocument", () => {
  const doc = ApiModule.buildOpenApiDocument();

  assert.equal(doc.openapi, "3.1.0");
  assert.ok(doc.info);
  assert.ok(doc.paths);
  assert.ok(doc.paths["/healthz"]);
  assert.ok(doc.paths["/v1/tasks"]);
});

test("api barrel openapi document listApiRoutes", () => {
  const routes = ApiModule.listApiRoutes();

  assert.ok(Array.isArray(routes));
  assert.ok(routes.length > 0);
  assert.ok(routes.some((r) => r.path === "/healthz"));
  assert.ok(routes.some((r) => r.path === "/v1/tasks"));
});

test("api barrel facade interfaces createNoOpIncidentFacadeService", () => {
  const service = ApiModule.createNoOpIncidentFacadeService();

  assert.equal(service.listIncidents().length, 0);
  assert.equal(service.getIncident("any_id"), null);

  assert.throws(
    () => service.openIncident({ severity: "high", title: "Test incident" }),
    /not configured/,
  );

  assert.throws(
    () => service.acknowledge("any_id", "any_owner"),
    /not configured/,
  );

  assert.throws(
    () => service.startMitigation("any_id"),
    /not configured/,
  );

  assert.throws(
    () => service.resolve("any_id"),
    /not configured/,
  );
});

test("api barrel oidc oauth service provider management", async () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    ["https://issuer.example.com"],
    "test-audience",
    undefined,
    true, // skipSignatureVerification for unit testing
  );

  // Register a provider manually
  service.registerProvider({
    issuer: "https://issuer.example.com",
    authorizationEndpoint: "https://issuer.example.com/auth",
    tokenEndpoint: "https://issuer.example.com/token",
    jwksUri: "https://issuer.example.com/jwks",
    scopes: ["openid", "profile"],
  });

  const provider = service.getProvider("https://issuer.example.com");
  assert.ok(provider !== null);
  assert.equal(provider?.issuer, "https://issuer.example.com");

  const providers = service.listProviders();
  assert.equal(providers.length, 1);
});

test("api barrel oidc oauth service api key management", () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    [],
    "test-audience",
    undefined,
    true,
  );

  // Register an API key
  service.registerApiKey("test_api_key", "actor_123", ["admin", "viewer"]);

  // Validate valid key
  const validResult = service.validateApiKey("test_api_key");
  assert.equal(validResult.valid, true);
  assert.equal(validResult.actorId, "actor_123");
  assert.deepEqual(validResult.roles, ["admin", "viewer"]);

  // Validate invalid key
  const invalidResult = service.validateApiKey("invalid_key");
  assert.equal(invalidResult.valid, false);
  assert.equal(invalidResult.actorId, null);
});

test("api barrel oidc oauth service api key rotation", () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    [],
    "test-audience",
    undefined,
    true,
  );

  service.registerApiKey("original_key", "actor_123", ["viewer"]);

  const rotationResult = service.initiateKeyRotation("original_key");
  assert.equal(rotationResult.success, true);
  assert.ok(rotationResult.rotationId?.startsWith("rot_"));
  assert.ok(rotationResult.newKey?.startsWith("ak_"));

  // Check rotation status
  const status = service.getRotationStatus(rotationResult.rotationId!);
  assert.ok(status !== null);
  assert.equal(status?.status, "rotating");

  // Complete rotation
  const completed = service.completeKeyRotation(rotationResult.rotationId!);
  assert.equal(completed, true);

  // Rotation should now be revoked
  const finalStatus = service.getRotationStatus(rotationResult.rotationId!);
  assert.ok(finalStatus !== null);
  assert.equal(finalStatus?.status, "revoked");
});

test("api barrel oidc oauth service key rotation for unknown key", () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    [],
    "test-audience",
    undefined,
    true,
  );

  const result = service.initiateKeyRotation("nonexistent_key");
  assert.equal(result.success, false);
  assert.equal(result.rotationId, null);
  assert.equal(result.newKey, null);
});

test("api barrel oidc oauth service complete rotation for unknown id", () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    [],
    "test-audience",
    undefined,
    true,
  );

  const result = service.completeKeyRotation("unknown_rotation_id");
  assert.equal(result, false);
});

test("api barrel oidc oauth service generate code verifier and challenge", () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    [],
    "test-audience",
    undefined,
    true,
  );

  const verifier = service.generateCodeVerifier();
  assert.ok(verifier.length > 0);

  const challenge = service.generateCodeChallenge(verifier);
  assert.ok(challenge.length > 0);

  // Same verifier should produce same challenge
  const challenge2 = service.generateCodeChallenge(verifier);
  assert.equal(challenge, challenge2);

  // Different verifier should produce different challenge
  const verifier2 = service.generateCodeVerifier();
  const challenge3 = service.generateCodeChallenge(verifier2);
  assert.notEqual(challenge, challenge3);
});

test("api barrel oidc oauth service build authorization url", () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    [],
    "test-audience",
    undefined,
    true,
  );

  const provider = {
    issuer: "https://idp.example.com",
    authorizationEndpoint: "https://idp.example.com/authorize",
    tokenEndpoint: "https://idp.example.com/token",
    jwksUri: "https://idp.example.com/jwks",
    scopes: ["openid", "profile", "email"],
  };

  const url = service.buildAuthorizationUrl(
    provider,
    "client_123",
    "https://app.example.com/callback",
    "state_abc",
    "challenge_xyz",
  );

  assert.ok(url.startsWith("https://idp.example.com/authorize"));
  assert.ok(url.includes("client_id=client_123"));
  assert.ok(url.includes("redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback"));
  assert.ok(url.includes("state=state_abc"));
  assert.ok(url.includes("code_challenge=challenge_xyz"));
  assert.ok(url.includes("code_challenge_method=S256"));
});

test("api barrel oidc oauth service build authorization url with custom scopes", () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    [],
    "test-audience",
    undefined,
    true,
  );

  const provider = {
    issuer: "https://idp.example.com",
    authorizationEndpoint: "https://idp.example.com/authorize",
    tokenEndpoint: "https://idp.example.com/token",
    jwksUri: "https://idp.example.com/jwks",
    scopes: ["openid", "profile"],
  };

  const url = service.buildAuthorizationUrl(
    provider,
    "client_123",
    "https://app.example.com/callback",
    "state_abc",
    "challenge_xyz",
    ["openid", "profile", "email", "custom_scope"],
  );

  assert.ok(url.includes("scope=openid+profile+email+custom_scope"));
});

test("api barrel oidc oauth service validate federated token - malformed jwt", async () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    ["https://issuer.example.com"],
    "test-audience",
    undefined,
    true,
  );

  const result = await service.validateFederatedToken("not.a.jwt");
  assert.equal(result.valid, false);
  assert.ok(result.error != null);
});

test("api barrel oidc oauth service validate federated token - untrusted issuer", async () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    ["https://trusted.example.com"],
    "test-audience",
    undefined,
    true,
  );

  // Create a mock token with untrusted issuer
  const mockPayload = {
    sub: "user123",
    iss: "https://untrusted.example.com",
    aud: "test-audience",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const header = { alg: "HS256" };
  const mockToken = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(mockPayload)).toString("base64url")}.fake_signature`;

  const result = await service.validateFederatedToken(mockToken);
  assert.equal(result.valid, false);
  assert.equal(result.error, "jwt.untrusted_issuer");
});

test("api barrel oidc oauth service validate federated token - invalid audience", async () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    ["https://issuer.example.com"],
    "test-audience",
    undefined,
    true,
  );

  const mockPayload = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "wrong-audience",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const header = { alg: "HS256" };
  const mockToken = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(mockPayload)).toString("base64url")}.fake_signature`;

  const result = await service.validateFederatedToken(mockToken);
  assert.equal(result.valid, false);
  assert.equal(result.error, "jwt.invalid_audience");
});

test("api barrel oidc oauth service validate federated token - expired token", async () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    ["https://issuer.example.com"],
    "test-audience",
    undefined,
    true,
  );

  const mockPayload = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "test-audience",
    exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    iat: Math.floor(Date.now() / 1000) - 7200,
  };
  const header = { alg: "HS256" };
  const mockToken = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(mockPayload)).toString("base64url")}.fake_signature`;

  const result = await service.validateFederatedToken(mockToken);
  assert.equal(result.valid, false);
  assert.equal(result.error, "jwt.token_expired");
});

test("api barrel oidc oauth service validate federated token - valid token", async () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    ["https://issuer.example.com"],
    "test-audience",
    undefined,
    true, // skipSignatureVerification
  );

  const mockPayload = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "test-audience",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    email: "user@example.com",
    roles: ["admin", "viewer"],
  };
  const header = { alg: "HS256" };
  const mockToken = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(mockPayload)).toString("base64url")}.fake_signature`;

  const result = await service.validateFederatedToken(mockToken);
  assert.equal(result.valid, true);
  assert.equal(result.error, null);
  assert.ok(result.claims !== null);
  assert.equal(result.claims?.sub, "user123");
  assert.equal(result.claims?.email, "user@example.com");
  assert.deepEqual(result.claims?.roles, ["admin", "viewer"]);
});

test("api barrel oidc oauth service validate federated token with array audience", async () => {
  const service = new ApiModule.OidcOAuthService(
    [],
    ["https://issuer.example.com"],
    "test-audience",
    undefined,
    true,
  );

  const mockPayload = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: ["other-audience", "test-audience", "another-audience"],
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const header = { alg: "HS256" };
  const mockToken = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(mockPayload)).toString("base64url")}.fake_signature`;

  const result = await service.validateFederatedToken(mockToken);
  assert.equal(result.valid, true);
  assert.ok(result.claims !== null);
});

test("api barrel mission control service snapshot with seeded context", () => {
  const workspace = createTempWorkspace("aa-api-barrel-");

  try {
    const context = createSeededApiContext(workspace);
    const snapshot = context.missionControlService.getSnapshot();

    assert.equal(snapshot.health.status, "ok");
    assert.ok(snapshot.taskBoard.length >= 1);

    context.db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("api barrel admin config service list updates with tenant filter", () => {
  const service = new ApiModule.AdminConfigService();

  service.applyUpdate({ key: "key_a", value: 1, tenantId: "tenant_a", updatedBy: "admin" });
  service.applyUpdate({ key: "key_b", value: 2, tenantId: "tenant_b", updatedBy: "admin" });
  service.applyUpdate({ key: "key_c", value: 3, tenantId: null, updatedBy: "admin" });

  const tenantA = service.listUpdates(50, "tenant_a");
  assert.equal(tenantA.length, 1);
  assert.equal(tenantA[0]?.key, "key_a");

  const tenantB = service.listUpdates(50, "tenant_b");
  assert.equal(tenantB.length, 1);
  assert.equal(tenantB[0]?.key, "key_b");

  const allRecords = service.listUpdates(50, undefined);
  assert.equal(allRecords.length, 3);
});

test("api barrel admin config service respects limit", () => {
  const service = new ApiModule.AdminConfigService();

  for (let i = 0; i < 10; i++) {
    service.applyUpdate({ key: `key_${i}`, value: i, updatedBy: "admin" });
  }

  const updates = service.listUpdates(3);
  assert.equal(updates.length, 3);
});

test("api barrel pack catalog service list packs with limit", () => {
  const service = new ApiModule.PackCatalogService();

  for (let i = 0; i < 5; i++) {
    service.createPack({
      packId: `pack_${i}`,
      name: `Pack ${i}`,
      version: "1.0.0",
      domainId: "test_domain",
      createdBy: "test_user",
    });
  }

  const packs = service.listPacks(2);
  assert.equal(packs.length, 2);
});

test("api barrel cost report service list budget summaries", () => {
  const service = new ApiModule.CostReportService();

  service.createReport({
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 50.0,
    resourceCosts: [],
    submittedBy: "user1",
    tenantId: "tenant_a",
  });

  service.createReport({
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 30.0,
    resourceCosts: [],
    submittedBy: "user2",
    tenantId: "tenant_a",
  });

  const summaries = service.listBudgetSummaries(50, "tenant_a");
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.totalCostUsd, 80.0);
  assert.equal(summaries[0]?.reportCount, 2);
});

test("api barrel cost report service empty list", () => {
  const service = new ApiModule.CostReportService();

  const reports = service.listReports();
  assert.equal(reports.length, 0);

  const summaries = service.listBudgetSummaries();
  assert.deepEqual(summaries, []);
});

test("api barrel pack catalog service duplicate packId throws", () => {
  const service = new ApiModule.PackCatalogService();

  service.createPack({
    packId: "duplicate_pack",
    name: "First Pack",
    version: "1.0.0",
    domainId: "domain",
    createdBy: "user",
  });

  assert.throws(
    () =>
      service.createPack({
        packId: "duplicate_pack",
        name: "Second Pack",
        version: "2.0.0",
        domainId: "domain",
        createdBy: "user",
      }),
    (err: unknown) => (err as { code?: string })?.code === "pack.already_exists",
  );
});
