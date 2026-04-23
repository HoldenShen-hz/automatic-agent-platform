import assert from "node:assert/strict";
import test from "node:test";

import {
  loadTenantPlatformCliEnv,
  loadEnterpriseCapabilityCliEnv,
  loadMarketplaceCliEnv,
  loadDeploymentExecutionCliEnv,
  loadControlPlaneBalancerCliEnv,
  loadOpsGovernanceCliEnv,
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
  TENANT_ACTIONS,
  ENTERPRISE_ACTIONS,
  MARKETPLACE_ACTIONS,
  DEPLOYMENT_EXECUTION_ACTIONS,
  CONTROL_PLANE_ACTIONS,
  OPS_GOVERNANCE_ACTIONS,
  SECRET_ACTIONS,
  WORKER_REGISTER_ACTIONS,
  GATEWAY_TARGET_ACTIONS,
  INSPECT_KINDS,
  SKILL_CREATOR_ACTIONS,
  SHADOW_SNAPSHOT_ACTIONS,
  MEMORY_ACTIONS,
  MODEL_ROUTE_CLASSES,
  MODEL_ROUTE_RISK_LEVELS,
} from "../../../../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
import { ValidationError } from "../../../../../../src/platform/contracts/errors.js";

test("loadTenantPlatformCliEnv returns config with defaults", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_TENANT_ACTION: "topology",
  };
  const config = loadTenantPlatformCliEnv(env);
  assert.equal(config.dbPath, "/data/test.db");
  assert.equal(config.action, "topology");
  assert.equal(config.planId, null);
  assert.equal(config.setAsOrganizationDefault, false);
});

test("loadTenantPlatformCliEnv parses optional fields", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_OWNER_ID: "owner-123",
    AA_DISPLAY_NAME: "Test Tenant",
    AA_PLAN_ID: "plan-basic",
    AA_WORKSPACE_ID: "ws-456",
    AA_ISOLATION_MODE: "dedicated_runtime",
    AA_DEPLOYMENT_MODE: "private_cloud",
    AA_SET_DEFAULT_TENANT: "true",
    AA_REGION: "us-west-2",
    AA_PLANE: "transactional",
  };
  const config = loadTenantPlatformCliEnv(env);
  assert.equal(config.ownerId, "owner-123");
  assert.equal(config.displayName, "Test Tenant");
  assert.equal(config.planId, "plan-basic");
  assert.equal(config.workspaceId, "ws-456");
  assert.equal(config.isolationMode, "dedicated_runtime");
  assert.equal(config.deploymentMode, "private_cloud");
  assert.equal(config.setAsOrganizationDefault, true);
  assert.equal(config.region, "us-west-2");
  assert.equal(config.plane, "transactional");
});

test("loadTenantPlatformCliEnv throws on missing AA_DB_PATH", () => {
  assert.throws(
    () => loadTenantPlatformCliEnv({}),
    (e: any) => e.code === "missing_env:AA_DB_PATH" && e instanceof ValidationError,
  );
});

test("loadTenantPlatformCliEnv throws on invalid isolation mode", () => {
  assert.throws(
    () => loadTenantPlatformCliEnv({ AA_DB_PATH: "/data/db", AA_ISOLATION_MODE: "invalid_mode" }),
    (e: any) => e.code === "invalid_env:AA_ISOLATION_MODE" && e instanceof ValidationError,
  );
});

test("loadEnterpriseCapabilityCliEnv returns config with defaults", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_ENTERPRISE_ACTION: "summary",
  };
  const config = loadEnterpriseCapabilityCliEnv(env);
  assert.equal(config.dbPath, "/data/test.db");
  assert.equal(config.action, "summary");
  assert.equal(config.isActive, true);
  assert.equal(config.reviewRequired, true);
});

test("loadEnterpriseCapabilityCliEnv parses optional fields", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_ENTERPRISE_ACTION: "register_readiness",
    AA_ARTIFACT_ROOT: "/artifacts",
    AA_READINESS_ID: "ready-123",
    AA_ENVIRONMENT: "prod",
    AA_COMPONENT_TYPE: "provider",
    AA_CREDENTIAL_READY: "true",
    AA_IS_ACTIVE: "false",
    AA_ACCOUNT_ID: "acc-456",
    AA_LIMIT: "50",
  };
  const config = loadEnterpriseCapabilityCliEnv(env);
  assert.equal(config.action, "register_readiness");
  assert.equal(config.artifactRoot, "/artifacts");
  assert.equal(config.readinessId, "ready-123");
  assert.equal(config.environment, "prod");
  assert.equal(config.componentType, "provider");
  assert.equal(config.credentialReady, true);
  assert.equal(config.isActive, false);
  assert.equal(config.accountId, "acc-456");
  assert.equal(config.limit, 50);
});

test("loadEnterpriseCapabilityCliEnv throws on missing AA_DB_PATH", () => {
  assert.throws(
    () => loadEnterpriseCapabilityCliEnv({}),
    (e: any) => e.code === "missing_env:AA_DB_PATH" && e instanceof ValidationError,
  );
});

test("loadMarketplaceCliEnv returns config with defaults", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_MARKETPLACE_ACTION: "summary",
  };
  const config = loadMarketplaceCliEnv(env);
  assert.equal(config.dbPath, "/data/test.db");
  assert.equal(config.action, "summary");
  assert.equal(config.lifecycleState, "installed");
  assert.equal(config.reviewRequired, true);
});

test("loadMarketplaceCliEnv parses package registration fields", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_MARKETPLACE_ACTION: "register_package",
    AA_PACKAGE_ID: "pkg-123",
    AA_PACKAGE_TYPE: "skill",
    AA_DISPLAY_NAME: "My Skill",
    AA_VERSION: "1.0.0",
    AA_OWNER: "user@example.com",
    AA_TRUST_LEVEL: "verified",
    AA_SIGNATURE_VERIFIED: "true",
    AA_CAPABILITIES_JSON: '["tool_use", "memory"]',
    AA_LIFECYCLE_STATE: "discovered",
  };
  const config = loadMarketplaceCliEnv(env);
  assert.equal(config.packageId, "pkg-123");
  assert.equal(config.packageType, "skill");
  assert.equal(config.displayName, "My Skill");
  assert.equal(config.version, "1.0.0");
  assert.equal(config.trustLevel, "verified");
  assert.equal(config.signatureVerified, true);
  assert.deepEqual(config.capabilities, ["tool_use", "memory"]);
  assert.equal(config.lifecycleState, "discovered");
});

test("loadMarketplaceCliEnv parses compatibility JSON", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_COMPATIBILITY_JSON: '{"apiContract":"v1","permissionSurface":"admin","runtimeCapability":"full"}',
  };
  const config = loadMarketplaceCliEnv(env);
  assert.deepEqual(config.compatibility, {
    apiContract: "v1",
    permissionSurface: "admin",
    runtimeCapability: "full",
  });
});

test("loadMarketplaceCliEnv throws on missing AA_DB_PATH", () => {
  assert.throws(
    () => loadMarketplaceCliEnv({}),
    (e: any) => e.code === "missing_env:AA_DB_PATH" && e instanceof ValidationError,
  );
});

test("loadDeploymentExecutionCliEnv returns config with defaults", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
  };
  const config = loadDeploymentExecutionCliEnv(env, "/repo");
  assert.equal(config.action, "build_report");
  assert.equal(config.dbPath, "/data/test.db");
  assert.equal(config.runnerMode, "local");
});

test("loadDeploymentExecutionCliEnv parses optional fields", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_DEPLOYMENT_EXECUTION_ACTION: "export",
    AA_DEPLOYMENT_REPO_ROOT: "/repo",
    AA_DEPLOYMENT_RUNNER_MODE: "simulate",
    AA_DEPLOYMENT_ENVIRONMENT: "staging",
    AA_DEPLOYMENT_VERSION: "2.0.0",
    AA_DEPLOYMENT_COMMIT_SHA: "abc123",
    AA_DEPLOYMENT_ROLLOUT_STRATEGY: "canary",
    AA_DEPLOYMENT_EXECUTE: "true",
    AA_TASK_ID: "task-789",
  };
  const config = loadDeploymentExecutionCliEnv(env, "/default");
  assert.equal(config.action, "export");
  assert.equal(config.repoRootDir, "/repo");
  assert.equal(config.runnerMode, "simulate");
  assert.equal(config.environment, "staging");
  assert.equal(config.version, "2.0.0");
  assert.equal(config.commitSha, "abc123");
  assert.equal(config.rolloutStrategy, "canary");
  assert.equal(config.execute, true);
  assert.equal(config.taskId, "task-789");
});

test("loadDeploymentExecutionCliEnv throws on missing AA_DB_PATH", () => {
  assert.throws(
    () => loadDeploymentExecutionCliEnv({}),
    (e: any) => e.code === "missing_env:AA_DB_PATH" && e instanceof ValidationError,
  );
});

test("loadControlPlaneBalancerCliEnv returns config with defaults", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_CONTROL_PLANE_ACTION: "summary",
  };
  const config = loadControlPlaneBalancerCliEnv(env);
  assert.equal(config.dbPath, "/data/test.db");
  assert.equal(config.action, "summary");
  assert.equal(config.shards, null);
});

test("loadControlPlaneBalancerCliEnv parses coordinator fields", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_CONTROL_PLANE_ACTION: "heartbeat",
    AA_COORDINATOR_ID: "coord-1",
    AA_COORDINATOR_REGION: "us-east",
    AA_COORDINATOR_ROLE: "primary",
    AA_COORDINATOR_STATUS: "active",
    AA_COORDINATOR_MAX_DISPATCHES: "100",
    AA_COORDINATOR_ACTIVE_DISPATCHES: "42",
    AA_COORDINATOR_BACKLOG: "15",
    AA_COORDINATOR_CPU_PCT: "65.5",
    AA_COORDINATOR_SHARDS_JSON: '["shard-a", "shard-b"]',
    AA_CONTROL_PLANE_QUEUE: "main-queue",
  };
  const config = loadControlPlaneBalancerCliEnv(env);
  assert.equal(config.coordinatorId, "coord-1");
  assert.equal(config.coordinatorRegion, "us-east");
  assert.equal(config.role, "primary");
  assert.equal(config.status, "active");
  assert.equal(config.maxConcurrentDispatches, 100);
  assert.equal(config.activeDispatchCount, 42);
  assert.equal(config.backlogCount, 15);
  assert.equal(config.cpuPct, 65.5);
  assert.deepEqual(config.shards, ["shard-a", "shard-b"]);
  assert.equal(config.queueName, "main-queue");
});

test("loadControlPlaneBalancerCliEnv throws on missing AA_DB_PATH", () => {
  assert.throws(
    () => loadControlPlaneBalancerCliEnv({}),
    (e: any) => e.code === "missing_env:AA_DB_PATH" && e instanceof ValidationError,
  );
});

test("loadOpsGovernanceCliEnv returns config", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_ENVIRONMENT: "prod",
    AA_OPS_GOVERNANCE_ACTION: "check",
  };
  const config = loadOpsGovernanceCliEnv(env);
  assert.equal(config.dbPath, "/data/test.db");
  assert.equal(config.environment, "prod");
  assert.equal(config.action, "check");
});

test("loadOpsGovernanceCliEnv throws on missing AA_DB_PATH", () => {
  assert.throws(
    () => loadOpsGovernanceCliEnv({}),
    (e: any) => e.code === "missing_env:AA_DB_PATH" && e instanceof ValidationError,
  );
});

test("loadOpsGovernanceCliEnv throws on missing AA_ENVIRONMENT", () => {
  assert.throws(
    () => loadOpsGovernanceCliEnv({ AA_DB_PATH: "/data/db" }),
    (e: any) => e.code === "missing_env:AA_ENVIRONMENT" && e instanceof ValidationError,
  );
});

test("loadSecretManagementCliEnv returns config with defaults", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_SECRET_ACTION: "summary",
  };
  const config = loadSecretManagementCliEnv(env);
  assert.equal(config.dbPath, "/data/test.db");
  assert.equal(config.action, "summary");
  assert.equal(config.breakGlass, false);
});

test("loadSecretManagementCliEnv parses secret fields", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_SECRET_ACTION: "register",
    AA_SECRET_REF: "secret/my-key",
    AA_SECRET_DISPLAY_NAME: "My Secret",
    AA_SECRET_CATEGORY: "api-key",
    AA_SECRET_PROVIDER_KIND: "vault",
    AA_SECRET_BREAK_GLASS: "true",
    AA_SECRET_METADATA: '{"owner":"team-a"}',
    AA_SECRET_ROTATION_CADENCE_DAYS: "90",
    AA_SECRET_TTL_MINUTES: "60",
  };
  const config = loadSecretManagementCliEnv(env);
  assert.equal(config.action, "register");
  assert.equal(config.secretRef, "secret/my-key");
  assert.equal(config.displayName, "My Secret");
  assert.equal(config.category, "api-key");
  assert.equal(config.providerKind, "vault");
  assert.equal(config.breakGlass, true);
  assert.deepEqual(config.metadata, { owner: "team-a" });
  assert.equal(config.rotationCadenceDays, 90);
  assert.equal(config.ttlMinutes, 60);
});

test("loadSecretManagementCliEnv throws on missing AA_DB_PATH", () => {
  assert.throws(
    () => loadSecretManagementCliEnv({}),
    (e: any) => e.code === "missing_env:AA_DB_PATH" && e instanceof ValidationError,
  );
});

test("loadWorkerRegisterCliEnv returns config", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_WORKER_REGISTER_ACTION: "issue",
    AA_CAPABILITIES_JSON: '["cap-a", "cap-b"]',
  };
  const config = loadWorkerRegisterCliEnv(env);
  assert.equal(config.dbPath, "/data/test.db");
  assert.equal(config.action, "issue");
  assert.deepEqual(config.capabilities, ["cap-a", "cap-b"]);
});

test("loadWorkerRegisterCliEnv parses worker fields", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_WORKER_REGISTER_ACTION: "complete",
    AA_WORKER_ID: "worker-1",
    AA_CHALLENGE_ID: "challenge-abc",
    AA_CHALLENGE_TOKEN: "tok-xyz",
    AA_CHALLENGE_TTL_MS: "30000",
    AA_MAX_CONCURRENCY: "10",
    AA_ISOLATION_LEVEL: "hardened",
    AA_REPO_VERSION: "1.2.3",
    AA_RUNTIME_INSTANCE_ID: "instance-123",
    AA_REMOTE_SESSION_STATUS: "connected",
  };
  const config = loadWorkerRegisterCliEnv(env);
  assert.equal(config.action, "complete");
  assert.equal(config.workerId, "worker-1");
  assert.equal(config.challengeId, "challenge-abc");
  assert.equal(config.challengeToken, "tok-xyz");
  assert.equal(config.challengeTtlMs, 30000);
  assert.equal(config.maxConcurrency, 10);
  assert.equal(config.isolationLevel, "hardened");
  assert.equal(config.repoVersion, "1.2.3");
  assert.equal(config.runtimeInstanceId, "instance-123");
  assert.equal(config.remoteSessionStatus, "connected");
});

test("loadWorkerRegisterCliEnv throws on missing AA_DB_PATH", () => {
  assert.throws(
    () => loadWorkerRegisterCliEnv({}),
    (e: any) => e.code === "missing_env:AA_DB_PATH" && e instanceof ValidationError,
  );
});

test("loadWorkerRegisterCliEnv throws on missing AA_WORKER_REGISTER_ACTION", () => {
  assert.throws(
    () => loadWorkerRegisterCliEnv({ AA_DB_PATH: "/data/db" }),
    (e: any) => e.code === "missing_env:AA_WORKER_REGISTER_ACTION" && e instanceof ValidationError,
  );
});

test("loadGatewayTargetsCliEnv returns config", () => {
  const env = {
    AA_GATEWAY_TARGET_ACTION: "upsert",
  };
  const config = loadGatewayTargetsCliEnv(env);
  assert.equal(config.action, "upsert");
  assert.equal(config.dbPath, undefined);
});

test("loadGatewayTargetsCliEnv parses target fields", () => {
  const env = {
    AA_DB_PATH: "/data/test.db",
    AA_GATEWAY_TARGET_ACTION: "list",
    AA_GATEWAY_CHANNEL: "channel-1",
    AA_GATEWAY_TARGET_KIND: "webhook",
    AA_GATEWAY_EXTERNAL_TARGET_ID: "ext-123",
    AA_GATEWAY_DISPLAY_NAME: "My Target",
    AA_GATEWAY_ALIASES_JSON: '["alias1", "alias2"]',
    AA_GATEWAY_METADATA_JSON: '{"priority":1}',
    AA_GATEWAY_LIMIT: "25",
  };
  const config = loadGatewayTargetsCliEnv(env);
  assert.equal(config.action, "list");
  assert.equal(config.dbPath, "/data/test.db");
  assert.equal(config.channel, "channel-1");
  assert.equal(config.targetKind, "webhook");
  assert.equal(config.externalTargetId, "ext-123");
  assert.equal(config.displayName, "My Target");
  assert.deepEqual(config.aliases, ["alias1", "alias2"]);
  assert.deepEqual(config.metadata, { priority: 1 });
  assert.equal(config.limit, 25);
});

test("loadGatewayTargetsCliEnv throws on missing AA_GATEWAY_TARGET_ACTION", () => {
  assert.throws(
    () => loadGatewayTargetsCliEnv({}),
    (e: any) => e.code === "missing_env:AA_GATEWAY_TARGET_ACTION" && e instanceof ValidationError,
  );
});

test("loadInspectCliEnv returns config", () => {
  const env = {
    AA_INSPECT_KIND: "task",
  };
  const config = loadInspectCliEnv(env);
  assert.equal(config.kind, "task");
  assert.equal(config.dbPath, undefined);
});

test("loadInspectCliEnv parses inspect fields", () => {
  const env = {
    AA_INSPECT_KIND: "execution",
    AA_TASK_ID: "task-123",
    AA_EXECUTION_ID: "exec-456",
    AA_APPROVAL_ID: "approval-789",
    AA_INSPECT_LIMIT: "50",
    AA_TASK_STATUS: "running",
    AA_WORKFLOW_ID: "wf-abc",
    AA_HAS_PENDING_APPROVAL: "true",
    AA_WORKER_STATUS: "idle",
  };
  const config = loadInspectCliEnv(env);
  assert.equal(config.kind, "execution");
  assert.equal(config.taskId, "task-123");
  assert.equal(config.executionId, "exec-456");
  assert.equal(config.approvalId, "approval-789");
  assert.equal(config.limit, 50);
  assert.equal(config.taskStatus, "running");
  assert.equal(config.workflowId, "wf-abc");
  assert.equal(config.hasPendingApproval, true);
  assert.equal(config.workerStatus, "idle");
});

test("loadInspectCliEnv throws on missing AA_INSPECT_KIND", () => {
  assert.throws(
    () => loadInspectCliEnv({}),
    (e: any) => e.code === "missing_env:AA_INSPECT_KIND" && e instanceof ValidationError,
  );
});

test("loadSkillCreatorCliEnv returns config", () => {
  const env = {
    AA_SKILL_CREATOR_ACTION: "create",
  };
  const config = loadSkillCreatorCliEnv(env);
  assert.equal(config.action, "create");
  assert.equal(config.registerInRegistry, false);
});

test("loadSkillCreatorCliEnv parses skill fields", () => {
  const env = {
    AA_SKILL_CREATOR_ACTION: "validate",
    AA_SKILL_REGISTER: "true",
    AA_SKILL_NAME: "my-skill",
    AA_SKILL_DESCRIPTION: "A useful skill",
    AA_SKILL_VERSION: "1.0.0",
    AA_SKILL_AUTHOR: "author@example.com",
    AA_SKILL_REQUIRED_TOOLS_JSON: '["tool_a", "tool_b"]',
    AA_SKILL_REQUIRED_PERMISSIONS_JSON: '["perm_x"]',
    AA_SKILL_TAGS_JSON: '["productivity", "automation"]',
    AA_SKILL_OVERWRITE: "true",
    AA_SKILL_CACHEABLE: "true",
    AA_SKILL_CACHE_TTL_SECONDS: "3600",
    AA_SKILL_RISK_LEVEL: "medium",
  };
  const config = loadSkillCreatorCliEnv(env);
  assert.equal(config.action, "validate");
  assert.equal(config.registerInRegistry, true);
  assert.equal(config.name, "my-skill");
  assert.equal(config.description, "A useful skill");
  assert.equal(config.version, "1.0.0");
  assert.equal(config.author, "author@example.com");
  assert.deepEqual(config.requiredTools, ["tool_a", "tool_b"]);
  assert.deepEqual(config.requiredPermissions, ["perm_x"]);
  assert.deepEqual(config.tags, ["productivity", "automation"]);
  assert.equal(config.overwriteAllowed, true);
  assert.equal(config.cacheable, true);
  assert.equal(config.cacheTtlSeconds, 3600);
  assert.equal(config.riskLevel, "medium");
});

test("loadSkillCreatorCliEnv throws on missing AA_SKILL_CREATOR_ACTION", () => {
  assert.throws(
    () => loadSkillCreatorCliEnv({}),
    (e: any) => e.code === "missing_env:AA_SKILL_CREATOR_ACTION" && e instanceof ValidationError,
  );
});

test("loadShadowSnapshotCliEnv returns config", () => {
  const env = {
    AA_WORKSPACE_ROOT: "/workspace",
    AA_SHADOW_ROOT: "/shadow",
    AA_SHADOW_SNAPSHOT_ACTION: "create",
  };
  const config = loadShadowSnapshotCliEnv(env);
  assert.equal(config.workspaceRoot, "/workspace");
  assert.equal(config.shadowRoot, "/shadow");
  assert.equal(config.action, "create");
  assert.equal(config.maxEntryBytes, null);
  assert.equal(config.excludedPaths, null);
});

test("loadShadowSnapshotCliEnv parses snapshot fields", () => {
  const env = {
    AA_WORKSPACE_ROOT: "/workspace",
    AA_SHADOW_ROOT: "/shadow",
    AA_SHADOW_SNAPSHOT_ACTION: "restore",
    AA_SHADOW_SNAPSHOT_MAX_ENTRY_BYTES: "1048576",
    AA_SHADOW_SNAPSHOT_EXCLUDES: "node_modules, .git, dist",
    AA_SHADOW_SNAPSHOT_ID: "snap-123",
    AA_SHADOW_SNAPSHOT_LABEL: "backup-label",
    AA_SHADOW_SNAPSHOT_REASON_CODE: "scheduled",
    AA_SHADOW_SNAPSHOT_ACTOR_ID: "actor-456",
  };
  const config = loadShadowSnapshotCliEnv(env);
  assert.equal(config.action, "restore");
  assert.equal(config.maxEntryBytes, 1048576);
  assert.deepEqual(config.excludedPaths, ["node_modules", ".git", "dist"]);
  assert.equal(config.snapshotId, "snap-123");
  assert.equal(config.label, "backup-label");
  assert.equal(config.reasonCode, "scheduled");
  assert.equal(config.actorId, "actor-456");
});

test("loadShadowSnapshotCliEnv throws on missing AA_WORKSPACE_ROOT", () => {
  assert.throws(
    () => loadShadowSnapshotCliEnv({ AA_SHADOW_ROOT: "/shadow", AA_SHADOW_SNAPSHOT_ACTION: "create" }),
    (e: any) => e.code === "missing_env:AA_WORKSPACE_ROOT" && e instanceof ValidationError,
  );
});

test("loadShadowSnapshotCliEnv throws on missing AA_SHADOW_ROOT", () => {
  assert.throws(
    () => loadShadowSnapshotCliEnv({ AA_WORKSPACE_ROOT: "/workspace", AA_SHADOW_SNAPSHOT_ACTION: "create" }),
    (e: any) => e.code === "missing_env:AA_SHADOW_ROOT" && e instanceof ValidationError,
  );
});

test("loadShadowSnapshotCliEnv throws on missing AA_SHADOW_SNAPSHOT_ACTION", () => {
  assert.throws(
    () => loadShadowSnapshotCliEnv({ AA_WORKSPACE_ROOT: "/workspace", AA_SHADOW_ROOT: "/shadow" }),
    (e: any) => e.code === "missing_env:AA_SHADOW_SNAPSHOT_ACTION" && e instanceof ValidationError,
  );
});

test("loadMemoryCliEnv returns config", () => {
  const env = {
    AA_MEMORY_ACTION: "initialize",
  };
  const config = loadMemoryCliEnv(env);
  assert.equal(config.action, "initialize");
  assert.equal(config.includeExpired, false);
  assert.equal(config.includeRevoked, false);
  assert.equal(config.prefetchAwait, true);
  assert.equal(config.revokeSourceMemories, true);
});

test("loadMemoryCliEnv parses memory fields", () => {
  const env = {
    AA_MEMORY_ACTION: "remember",
    AA_TASK_ID: "task-123",
    AA_SESSION_ID: "session-456",
    AA_AGENT_ID: "agent-789",
    AA_MEMORY_LAYER: "layer_1",
    AA_MEMORY_SOURCE_TRUST: "high",
    AA_MEMORY_SCOPES: "context, experience",
    AA_MEMORY_LAYERS: "layer_1, layer_2",
    AA_MEMORY_QUALITY_SCORE: "85",
    AA_MEMORY_LIMIT: "100",
    AA_MEMORY_QUERY_TEXT: "recent tasks",
    AA_MEMORY_INCLUDE_EXPIRED: "true",
    AA_MEMORY_INCLUDE_REVOKED: "true",
    AA_MEMORY_PREFETCH_AWAIT: "false",
    AA_MEMORY_REVOKE_SOURCES: "false",
  };
  const config = loadMemoryCliEnv(env);
  assert.equal(config.action, "remember");
  assert.equal(config.taskId, "task-123");
  assert.equal(config.sessionId, "session-456");
  assert.equal(config.agentId, "agent-789");
  assert.equal(config.memoryLayer, "layer_1");
  assert.equal(config.sourceTrustLevel, "high");
  assert.deepEqual(config.scopes, ["context", "experience"]);
  assert.deepEqual(config.memoryLayers, ["layer_1", "layer_2"]);
  assert.equal(config.qualityScore, 85);
  assert.equal(config.limit, 100);
  assert.equal(config.queryText, "recent tasks");
  assert.equal(config.includeExpired, true);
  assert.equal(config.includeRevoked, true);
  assert.equal(config.prefetchAwait, false);
  assert.equal(config.revokeSourceMemories, false);
});

test("loadMemoryCliEnv parses typed JSON fields", () => {
  const env = {
    AA_MEMORY_ACTION: "remember",
    AA_MEMORY_CONTENT_JSON: '{"text":"hello world"}',
    AA_MEMORY_FACTS_JSON: '[{"content":"fact 1","confidence":0.9}]',
    AA_EXPERIENCE_TASK_CONTEXT: "testing context",
    AA_EXPERIENCE_TASK_INTENT: "test intent",
  };
  const config = loadMemoryCliEnv(env);
  assert.deepEqual(config.contentJson, { text: "hello world" });
  assert.equal(config.experienceTaskContext, "testing context");
  assert.equal(config.experienceTaskIntent, "test intent");
});

test("loadMemoryCliEnv throws on missing AA_MEMORY_ACTION", () => {
  assert.throws(
    () => loadMemoryCliEnv({}),
    (e: any) => e.code === "missing_env:AA_MEMORY_ACTION" && e instanceof ValidationError,
  );
});

test("buildMemoryProviderQuery builds query from config", () => {
  const env = {
    AA_MEMORY_ACTION: "list",
    AA_TASK_ID: "task-123",
    AA_SESSION_ID: "session-456",
    AA_AGENT_ID: "agent-789",
    AA_MEMORY_SCOPES: "context, experience",
    AA_MEMORY_LAYERS: "layer_1, layer_2",
    AA_MEMORY_CLASSIFICATIONS: "important, routine",
    AA_MEMORY_SOURCE_TRUST_LEVELS: "high, medium",
    AA_MEMORY_MIN_QUALITY_SCORE: "70",
    AA_MEMORY_LIMIT: "50",
    AA_MEMORY_MAX_PROMPT_MEMORIES: "20",
    AA_MEMORY_MAX_FEWSHOT_EXAMPLES: "5",
    AA_MEMORY_QUERY_TEXT: "find tasks",
    AA_MEMORY_TASK_INTENT: "task intent",
    AA_MEMORY_TOOL_NAMES: "tool_a, tool_b",
    AA_MEMORY_INCLUDE_EXPERIENCE_EXAMPLES: "true",
  };
  const config = loadMemoryCliEnv(env);
  const query = buildMemoryProviderQuery(config);
  assert.equal(query.taskId, "task-123");
  assert.equal(query.sessionId, "session-456");
  assert.equal(query.agentId, "agent-789");
  assert.deepEqual(query.scopes, ["context", "experience"]);
  assert.deepEqual(query.memoryLayers, ["layer_1", "layer_2"]);
  assert.deepEqual(query.classifications, ["important", "routine"]);
  assert.deepEqual(query.sourceTrustLevels, ["high", "medium"]);
  assert.equal(query.minQualityScore, 70);
  assert.equal(query.limit, 50);
  assert.equal(query.maxPromptMemories, 20);
  assert.equal(query.maxFewShotExamples, 5);
  assert.equal(query.queryText, "find tasks");
  assert.equal(query.taskIntent, "task intent");
  assert.deepEqual(query.toolNames, ["tool_a", "tool_b"]);
  assert.equal(query.includeExperienceExamples, true);
});

test("buildMemoryProviderQuery returns empty object when no fields set", () => {
  const env = { AA_MEMORY_ACTION: "list" };
  const config = loadMemoryCliEnv(env);
  const query = buildMemoryProviderQuery(config);
  assert.deepEqual(query, {});
});

test("buildStructuredMemoryContentFromCliEnv returns undefined when no fields", () => {
  const env = { AA_MEMORY_ACTION: "list" };
  const config = loadMemoryCliEnv(env);
  const content = buildStructuredMemoryContentFromCliEnv(config);
  assert.equal(content, undefined);
});

test("buildStructuredMemoryContentFromCliEnv returns structured content", () => {
  const env = {
    AA_MEMORY_ACTION: "remember",
    AA_MEMORY_WORK_CONTEXT: "current project",
    AA_MEMORY_TOP_OF_MIND: "urgent, important",
    AA_MEMORY_RECENT_HISTORY: "task1, task2",
    AA_MEMORY_LONG_TERM_BACKGROUND: "background info",
  };
  const config = loadMemoryCliEnv(env);
  const content = buildStructuredMemoryContentFromCliEnv(config);
  assert.notEqual(content, undefined);
  assert.equal(content!.schemaVersion, "memory.v2");
  assert.equal(content!.workContext, "current project");
  assert.deepEqual(content!.topOfMind, ["urgent", "important"]);
  assert.deepEqual(content!.recentHistory, ["task1", "task2"]);
  assert.deepEqual(content!.longTermBackground, ["background info"]);
  assert.deepEqual(content!.facts, []);
});

test("buildStructuredMemoryContentFromCliEnv returns content with facts", () => {
  const env = {
    AA_MEMORY_ACTION: "remember",
    AA_MEMORY_FACTS_JSON: '[{"content":"fact1","confidence":0.8}]',
  };
  const config = loadMemoryCliEnv(env);
  const content = buildStructuredMemoryContentFromCliEnv(config);
  assert.notEqual(content, undefined);
  assert.equal(content!.schemaVersion, "memory.v2");
  assert.deepEqual(content!.facts, [{ content: "fact1", confidence: 0.8 }]);
});

test("loadModelRoutingCliEnv returns config with defaults", () => {
  const env = {};
  const config = loadModelRoutingCliEnv(env);
  assert.equal(config.routeClass, undefined);
  assert.equal(config.riskLevel, undefined);
  assert.equal(config.allowStrongUpgrade, false);
  assert.equal(config.loadGovernanceSnapshot, false);
});

test("loadModelRoutingCliEnv parses routing fields", () => {
  const env = {
    AA_CONFIG_ROOT: "/config",
    AA_DB_PATH: "/data/test.db",
    AA_MODEL_ROUTE_CLASS: "coding",
    AA_MODEL_ROUTE_RISK_LEVEL: "high",
    AA_MODEL_ROUTE_PREFERRED_PROFILE: "profile-a",
    AA_MODEL_ROUTE_PINNED_PROFILE: "profile-b",
    AA_MODEL_ROUTE_STICKY_PROFILE: "profile-c",
    AA_MODEL_ROUTE_TURN_ID: "turn-123",
    AA_MODEL_ROUTE_MAX_INPUT_PER_1K_USD: "1000000",
    AA_MODEL_ROUTE_REQUIRED_CAPABILITIES: "vision, streaming",
    AA_MODEL_ROUTE_ALLOW_STRONG_UPGRADE: "true",
    AA_MODEL_ROUTE_LOAD_GOVERNANCE_SNAPSHOT: "true",
  };
  const config = loadModelRoutingCliEnv(env);
  assert.equal(config.configRoot, "/config");
  assert.equal(config.dbPath, "/data/test.db");
  assert.equal(config.routeClass, "coding");
  assert.equal(config.riskLevel, "high");
  assert.equal(config.preferredProfileName, "profile-a");
  assert.equal(config.pinnedProfileName, "profile-b");
  assert.equal(config.stickyProfileName, "profile-c");
  assert.equal(config.turnId, "turn-123");
  assert.equal(config.maxInputPer1kUsd, 1000000);
  assert.deepEqual(config.requiredCapabilities, ["vision", "streaming"]);
  assert.equal(config.allowStrongUpgrade, true);
  assert.equal(config.loadGovernanceSnapshot, true);
});

test("loadModelRoutingCliEnv parses typed JSON fields", () => {
  const env = {
    AA_MODEL_ROUTE_FALLBACK_LEASE_JSON: '{"profile":"fallback","ttlMs":5000}',
    AA_MODEL_ROUTE_GOVERNANCE_SNAPSHOT_JSON: '{"version":"1.0","rules":[]}',
  };
  const config = loadModelRoutingCliEnv(env);
  assert.deepEqual(config.fallbackLease, { profile: "fallback", ttlMs: 5000 });
  assert.deepEqual(config.governanceSnapshot, { version: "1.0", rules: [] });
});

test("loadModelRoutingCliEnv parses provider health JSON with string values", () => {
  const env = {
    AA_MODEL_HEALTH_JSON: '{"provider-a":"healthy","provider-b":"degraded"}',
  };
  const config = loadModelRoutingCliEnv(env);
  assert.deepEqual(config.providerHealth, {
    "provider-a": { status: "healthy", successRate: 1, totalCalls: 0, failedCalls: 0, fallbackCount: 0, latestFailureCodes: [] },
    "provider-b": { status: "degraded", successRate: 0.75, totalCalls: 0, failedCalls: 0, fallbackCount: 0, latestFailureCodes: [] },
  });
});

test("loadModelRoutingCliEnv parses provider health JSON with object values", () => {
  const env = {
    AA_MODEL_HEALTH_JSON: '{"provider-x":{"status":"healthy","successRate":0.99,"totalCalls":1000,"failedCalls":10}}',
  };
  const config = loadModelRoutingCliEnv(env);
  assert.deepEqual(config.providerHealth, {
    "provider-x": { status: "healthy", successRate: 0.99, totalCalls: 1000, failedCalls: 10, fallbackCount: 0, latestFailureCodes: [] },
  });
});

test("loadModelRoutingCliEnv throws on invalid provider health status", () => {
  assert.throws(
    () => loadModelRoutingCliEnv({ AA_MODEL_HEALTH_JSON: '{"bad":"unknown"}' }),
    (e: any) => e.code === "invalid_env:AA_MODEL_HEALTH_JSON" && e instanceof ValidationError,
  );
});

test("loadModelRoutingCliEnv throws on invalid model health JSON string status", () => {
  assert.throws(
    () => loadModelRoutingCliEnv({ AA_MODEL_HEALTH_JSON: '{"p":"invalid_status"}' }),
    (e: any) => e.code === "invalid_env:AA_MODEL_HEALTH_JSON" && e instanceof ValidationError,
  );
});

test("loadModelRoutingCliEnv throws on invalid fallback lease JSON", () => {
  assert.throws(
    () => loadModelRoutingCliEnv({ AA_MODEL_ROUTE_FALLBACK_LEASE_JSON: "not-json" }),
    (e: any) => e.code.startsWith("invalid_json:") && e instanceof ValidationError,
  );
});
