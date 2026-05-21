import assert from "node:assert/strict";
import test from "node:test";
import {
  loadTenantPlatformCliEnv,
  loadEnterpriseCapabilityCliEnv,
  loadMarketplaceCliEnv,
  loadDeploymentExecutionCliEnv,
  loadControlPlaneBalancerCliEnv,
  loadSecretManagementCliEnv,
  loadWorkerRegisterCliEnv,
  loadGatewayTargetsCliEnv,
  loadInspectCliEnv,
  loadSkillCreatorCliEnv,
  loadShadowSnapshotCliEnv,
  loadMemoryCliEnv,
  buildMemoryProviderQuery,
  buildStructuredMemoryContentFromCliEnv,
  loadModelRoutingCliEnv,
} from "../../../../../src/platform/five-plane-control-plane/config-center/remaining-cli-env-loaders.js";

test("loadTenantPlatformCliEnv parses tenant platform config", () => {
  const config = loadTenantPlatformCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_TENANT_ACTION: "topology",
    AA_OWNER_ID: "owner-123",
    AA_TENANT_ID: "tenant-456",
  });
  assert.equal(config.dbPath, "/tmp/test.db");
  assert.equal(config.action, "topology");
  assert.equal(config.ownerId, "owner-123");
  assert.equal(config.tenantId, "tenant-456");
});

test("loadTenantPlatformCliEnv defaults isolation mode", () => {
  const config = loadTenantPlatformCliEnv({
    AA_DB_PATH: "/tmp/test.db",
  });
  assert.equal(config.isolationMode, "shared_logical");
});

test("loadEnterpriseCapabilityCliEnv parses enterprise capability config", () => {
  const config = loadEnterpriseCapabilityCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_ENTERPRISE_ACTION: "summary",
    AA_ARTIFACT_ROOT: "/artifacts",
    AA_IS_ACTIVE: "false",
  });
  assert.equal(config.action, "summary");
  assert.equal(config.artifactRoot, "/artifacts");
  assert.equal(config.isActive, false);
});

test("loadMarketplaceCliEnv parses marketplace config", () => {
  const config = loadMarketplaceCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_MARKETPLACE_ACTION: "publish",
    AA_PACKAGE_ID: "pkg-123",
    AA_PACKAGE_TYPE: "skill",
    AA_TRUST_LEVEL: "verified",
  });
  assert.equal(config.action, "publish");
  assert.equal(config.packageId, "pkg-123");
  assert.equal(config.packageType, "skill");
  assert.equal(config.trustLevel, "verified");
});

test("loadDeploymentExecutionCliEnv parses deployment execution config", () => {
  const config = loadDeploymentExecutionCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_DEPLOYMENT_EXECUTION_ACTION: "build_report",
    AA_DEPLOYMENT_RUNNER_MODE: "simulate",
  });
  assert.equal(config.action, "build_report");
  assert.equal(config.runnerMode, "simulate");
});

test("loadControlPlaneBalancerCliEnv parses coordinator shards", () => {
  const config = loadControlPlaneBalancerCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_CONTROL_PLANE_ACTION: "summary",
    AA_COORDINATOR_SHARDS_JSON: '["shard1","shard2"]',
  });
  assert.deepEqual(config.shards, ["shard1", "shard2"]);
});

test("loadControlPlaneBalancerCliEnv defaults status to active", () => {
  const config = loadControlPlaneBalancerCliEnv({
    AA_DB_PATH: "/tmp/test.db",
  });
  assert.equal(config.status, "active");
});

test("loadSecretManagementCliEnv parses secret management config", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "lease",
    AA_SECRET_REF: "secret/my-secret",
    AA_SECRET_CATEGORY: "api-key",
    AA_SECRET_BREAK_GLASS: "true",
  });
  assert.equal(config.action, "lease");
  assert.equal(config.secretRef, "secret/my-secret");
  assert.equal(config.category, "api-key");
  assert.equal(config.breakGlass, true);
});

test("loadWorkerRegisterCliEnv parses worker registration config", () => {
  const config = loadWorkerRegisterCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_WORKER_REGISTER_ACTION: "challenge",
    AA_CAPABILITIES_JSON: '["bash","read"]',
    AA_ISOLATION_LEVEL: "hardened",
  });
  assert.equal(config.action, "challenge");
  assert.deepEqual(config.capabilities, ["bash", "read"]);
  assert.equal(config.isolationLevel, "hardened");
});

test("loadGatewayTargetsCliEnv parses gateway targets config", () => {
  const config = loadGatewayTargetsCliEnv({
    AA_GATEWAY_TARGET_ACTION: "register",
    AA_GATEWAY_CHANNEL: "default",
    AA_GATEWAY_TARGET_KIND: "webhook",
  });
  assert.equal(config.action, "register");
  assert.equal(config.channel, "default");
  assert.equal(config.targetKind, "webhook");
});

test("loadInspectCliEnv parses inspect config", () => {
  const config = loadInspectCliEnv({
    AA_INSPECT_KIND: "task",
    AA_TASK_ID: "task-123",
    AA_LIMIT: "50",
    AA_HAS_PENDING_APPROVAL: "true",
  });
  assert.equal(config.kind, "task");
  assert.equal(config.taskId, "task-123");
  assert.equal(config.limit, 50);
  assert.equal(config.hasPendingApproval, true);
});

test("loadSkillCreatorCliEnv parses skill creator config", () => {
  const config = loadSkillCreatorCliEnv({
    AA_SKILL_CREATOR_ACTION: "register",
    AA_SKILL_REGISTER: "true",
    AA_SKILL_NAME: "my-skill",
    AA_SKILL_TAGS_JSON: '["tag1","tag2"]',
  });
  assert.equal(config.action, "register");
  assert.equal(config.registerInRegistry, true);
  assert.equal(config.name, "my-skill");
  assert.deepEqual(config.tags, ["tag1", "tag2"]);
});

test("loadShadowSnapshotCliEnv parses shadow snapshot config", () => {
  const config = loadShadowSnapshotCliEnv({
    AA_WORKSPACE_ROOT: "/workspace",
    AA_SHADOW_ROOT: "/shadow",
    AA_SHADOW_SNAPSHOT_ACTION: "create",
    AA_SHADOW_SNAPSHOT_MAX_ENTRY_BYTES: "1000000",
  });
  assert.equal(config.workspaceRoot, "/workspace");
  assert.equal(config.shadowRoot, "/shadow");
  assert.equal(config.action, "create");
  assert.equal(config.maxEntryBytes, 1000000);
});

test("loadMemoryCliEnv parses memory config", () => {
  const config = loadMemoryCliEnv({
    AA_MEMORY_ACTION: "store",
    AA_MEMORY_SCOPE: "task",
    AA_TASK_ID: "task-123",
    AA_MEMORY_TEXT: "some memory text",
    AA_MEMORY_CLASSIFICATION: "experience",
  });
  assert.equal(config.action, "store");
  assert.equal(config.scope, "task");
  assert.equal(config.taskId, "task-123");
  assert.equal(config.memoryText, "some memory text");
});

test("buildMemoryProviderQuery builds query from memory config", () => {
  const config = loadMemoryCliEnv({
    AA_MEMORY_ACTION: "query",
    AA_TASK_ID: "task-123",
    AA_MEMORY_LAYERS: "layer_1,layer_2",
    AA_LIMIT: "10",
  });
  const query = buildMemoryProviderQuery(config);
  assert.equal(query.taskId, "task-123");
  assert.ok(Array.isArray(query.memoryLayers));
  assert.equal(query.limit, 10);
});

test("buildStructuredMemoryContentFromCliEnv returns structured content", () => {
  const config = loadMemoryCliEnv({
    AA_MEMORY_ACTION: "store",
    AA_WORK_CONTEXT: "working on API design",
    AA_TOP_OF_MIND: "performance optimization",
  });
  const content = buildStructuredMemoryContentFromCliEnv(config);
  assert.ok(content != null);
  assert.equal(content!.workContext, "working on API design");
  assert.deepEqual(content!.topOfMind, ["performance optimization"]);
});

test("buildStructuredMemoryContentFromCliEnv returns undefined when no content fields", () => {
  const config = loadMemoryCliEnv({
    AA_MEMORY_ACTION: "store",
  });
  const content = buildStructuredMemoryContentFromCliEnv(config);
  assert.equal(content, undefined);
});

test("loadModelRoutingCliEnv parses model routing config", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_CLASS: "balanced",
    AA_MODEL_ROUTE_RISK_LEVEL: "medium",
    AA_MODEL_ROUTE_ALLOW_STRONG_UPGRADE: "true",
  });
  assert.equal(config.routeClass, "balanced");
  assert.equal(config.riskLevel, "medium");
  assert.equal(config.allowStrongUpgrade, true);
});

test("loadModelRoutingCliEnv parses fallback lease from JSON", () => {
  const config = loadModelRoutingCliEnv({
    AA_MODEL_ROUTE_FALLBACK_LEASE_JSON: '{"leaseId":"lease-123","expiresAt":"2024-01-01T00:00:00Z"}',
  });
  assert.ok(config.fallbackLease != null);
});

test("loadSecretManagementCliEnv parses rotation config", () => {
  const config = loadSecretManagementCliEnv({
    AA_DB_PATH: "/tmp/test.db",
    AA_SECRET_ACTION: "rotate",
    AA_SECRET_ROTATION_MODE: "automatic",
    AA_SECRET_ROTATION_CADENCE_DAYS: "30",
  });
  assert.equal(config.rotationMode, "automatic");
  assert.equal(config.rotationCadenceDays, 30);
});
