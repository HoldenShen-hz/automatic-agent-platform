import assert from "node:assert/strict";
import test from "node:test";
import { loadMemoryCliEnv, loadModelRoutingCliEnv, loadControlPlaneBalancerCliEnv, loadDeploymentExecutionCliEnv, loadMarketplaceCliEnv, loadSecretManagementCliEnv, loadTenantPlatformCliEnv, loadWorkerRegisterCliEnv, } from "../../../../../src/platform/control-plane/config-center/remaining-cli-env.js";
test("remaining CLI env loader parses tenant platform creation inputs", () => {
    const config = loadTenantPlatformCliEnv({
        AA_DB_PATH: "/tmp/tenant.db",
        AA_TENANT_ACTION: "create_tenant",
        AA_ORGANIZATION_ID: "org-1",
        AA_STORAGE_SCOPE: "tenant.storage",
        AA_IDENTITY_SCOPE: "tenant.identity",
        AA_POLICY_SCOPE: "tenant.policy",
        AA_ARTIFACT_SCOPE: "tenant.artifacts",
        AA_DEPLOYMENT_MODE: "private_cloud",
        AA_SET_DEFAULT_TENANT: "true",
    });
    assert.equal(config.action, "create_tenant");
    assert.equal(config.organizationId, "org-1");
    assert.equal(config.deploymentMode, "private_cloud");
    assert.equal(config.setAsOrganizationDefault, true);
});
test("remaining CLI env loader rejects invalid control-plane shards JSON", () => {
    assert.throws(() => loadControlPlaneBalancerCliEnv({
        AA_DB_PATH: "/tmp/control-plane.db",
        AA_COORDINATOR_SHARDS_JSON: "{\"bad\":true}",
    }), /invalid_env:AA_COORDINATOR_SHARDS_JSON/);
});
test("remaining CLI env loader parses marketplace compatibility and findings", () => {
    const config = loadMarketplaceCliEnv({
        AA_DB_PATH: "/tmp/marketplace.db",
        AA_MARKETPLACE_ACTION: "submit_review",
        AA_FINDINGS_JSON: JSON.stringify(["policy_gap"]),
        AA_COMPATIBILITY_JSON: JSON.stringify({
            apiContract: "v1",
            permissionSurface: "workspace_write",
            runtimeCapability: "multi-step-orchestration",
        }),
    });
    assert.deepEqual(config.findings, ["policy_gap"]);
    assert.equal(config.compatibility?.runtimeCapability, "multi-step-orchestration");
});
test("remaining CLI env loader parses deployment execution defaults", () => {
    const config = loadDeploymentExecutionCliEnv({
        AA_DB_PATH: "/tmp/deploy.db",
        AA_DEPLOYMENT_ENVIRONMENT: "staging",
        AA_DEPLOYMENT_VERSION: "1.2.3",
        AA_DEPLOYMENT_COMMIT_SHA: "abc123",
        AA_DEPLOYMENT_ROLLOUT_STRATEGY: "canary",
    }, "/workspace/repo");
    assert.equal(config.action, "summary");
    assert.equal(config.repoRootDir, "/workspace/repo");
    assert.equal(config.artifactRoot, "/workspace/repo/data/artifacts");
});
test("remaining CLI env loader parses secret-management payloads and worker registration capabilities", () => {
    const secretConfig = loadSecretManagementCliEnv({
        AA_DB_PATH: "/tmp/secrets.db",
        AA_SECRET_ACTION: "register",
        AA_SECRET_METADATA: JSON.stringify({ owner: "ops" }),
    });
    const workerConfig = loadWorkerRegisterCliEnv({
        AA_DB_PATH: "/tmp/worker.db",
        AA_WORKER_REGISTER_ACTION: "issue",
        AA_CAPABILITIES_JSON: JSON.stringify(["bash", "repo-map"]),
    });
    assert.equal(secretConfig.metadata?.owner, "ops");
    assert.deepEqual(workerConfig.capabilities, ["bash", "repo-map"]);
});
test("remaining CLI env loader parses memory and model-routing payloads", () => {
    const memoryConfig = loadMemoryCliEnv({
        AA_MEMORY_ACTION: "prefetch",
        AA_DB_PATH: "/tmp/memory.db",
        AA_TASK_ID: "task-1",
        AA_MEMORY_SCOPES: "task,session",
        AA_MEMORY_LAYERS: "layer_1,layer_2",
        AA_MEMORY_INCLUDE_EXPERIENCE_EXAMPLES: "true",
        AA_MEMORY_PREFETCH_AWAIT: "false",
    });
    const routingConfig = loadModelRoutingCliEnv({
        AA_CONFIG_ROOT: "/tmp/config",
        AA_MODEL_ROUTE_CLASS: "reasoning",
        AA_MODEL_ROUTE_RISK_LEVEL: "medium",
        AA_MODEL_ROUTE_ALLOW_STRONG_UPGRADE: "true",
        AA_MODEL_HEALTH_JSON: JSON.stringify({
            openai: "healthy",
            anthropic: { status: "degraded", successRate: 0.75, totalCalls: 10, failedCalls: 2, fallbackCount: 1 },
        }),
    });
    assert.deepEqual(memoryConfig.scopes, ["task", "session"]);
    assert.deepEqual(memoryConfig.memoryLayers, ["layer_1", "layer_2"]);
    assert.equal(memoryConfig.includeExperienceExamples, true);
    assert.equal(memoryConfig.prefetchAwait, false);
    assert.equal(routingConfig.routeClass, "reasoning");
    assert.equal(routingConfig.riskLevel, "medium");
    assert.equal(routingConfig.allowStrongUpgrade, true);
    assert.equal(routingConfig.providerHealth.openai?.status, "healthy");
    assert.equal(routingConfig.providerHealth.anthropic?.status, "degraded");
});
//# sourceMappingURL=remaining-cli-env.test.js.map