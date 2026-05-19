/**
 * Deployment Execution CLI Environment Loader Tests
 *
 * Tests for the deployment execution CLI environment variable loader
 * which supports deployment workflow operations.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadDeploymentExecutionCliEnv } from "../../../src/platform/control-plane/config-center/remaining-cli-env-loaders.js";
test("loadDeploymentExecutionCliEnv parses all environment variables", () => {
    const config = loadDeploymentExecutionCliEnv({
        AA_DEPLOYMENT_EXECUTION_ACTION: "export",
        AA_DEPLOYMENT_REPO_ROOT: "/repo",
        AA_DB_PATH: "/tmp/deploy.db",
        AA_DEPLOYMENT_ARTIFACT_ROOT: "/tmp/artifacts",
        AA_DEPLOYMENT_RUNNER_MODE: "simulate",
        AA_DEPLOYMENT_ENVIRONMENT: "prod",
        AA_DEPLOYMENT_VERSION: "1.2.3",
        AA_DEPLOYMENT_COMMIT_SHA: "abcdef12",
        AA_DEPLOYMENT_ROLLOUT_STRATEGY: "canary",
        AA_GENERATED_AT: "2026-04-26T00:00:00.000Z",
        AA_TASK_ID: "task-123",
        AA_DEPLOYMENT_EXECUTE: "true",
    });
    assert.equal(config.action, "export");
    assert.equal(config.repoRootDir, "/repo");
    assert.equal(config.dbPath, "/tmp/deploy.db");
    assert.equal(config.artifactRoot, "/tmp/artifacts");
    assert.equal(config.runnerMode, "simulate");
    assert.equal(config.environment, "prod");
    assert.equal(config.version, "1.2.3");
    assert.equal(config.commitSha, "abcdef12");
    assert.equal(config.rolloutStrategy, "canary");
    assert.equal(config.generatedAt, "2026-04-26T00:00:00.000Z");
    assert.equal(config.taskId, "task-123");
    assert.equal(config.execute, true);
});
test("loadDeploymentExecutionCliEnv defaults to build_report action", () => {
    const config = loadDeploymentExecutionCliEnv({
        AA_DB_PATH: "/tmp/db",
    });
    assert.equal(config.action, "build_report");
});
test("loadDeploymentExecutionCliEnv defaults to local runner mode", () => {
    const config = loadDeploymentExecutionCliEnv({
        AA_DB_PATH: "/tmp/db",
    });
    assert.equal(config.runnerMode, "local");
});
test("loadDeploymentExecutionCliEnv defaults artifact root to repo/data/artifacts", () => {
    const config = loadDeploymentExecutionCliEnv({
        AA_DB_PATH: "/tmp/db",
        AA_DEPLOYMENT_REPO_ROOT: "/myrepo",
    });
    assert.equal(config.artifactRoot, "/myrepo/data/artifacts");
});
test("loadDeploymentExecutionCliEnv rejects invalid action", () => {
    assert.throws(() => loadDeploymentExecutionCliEnv({
        AA_DB_PATH: "/tmp/db",
        AA_DEPLOYMENT_EXECUTION_ACTION: "invalid",
    }), /invalid_env:AA_DEPLOYMENT_EXECUTION_ACTION/);
});
test("loadDeploymentExecutionCliEnv rejects invalid environment", () => {
    assert.throws(() => loadDeploymentExecutionCliEnv({
        AA_DB_PATH: "/tmp/db",
        AA_DEPLOYMENT_ENVIRONMENT: "invalid",
    }), /invalid_env:AA_DEPLOYMENT_ENVIRONMENT/);
});
test("loadDeploymentExecutionCliEnv rejects invalid rollout strategy", () => {
    assert.throws(() => loadDeploymentExecutionCliEnv({
        AA_DB_PATH: "/tmp/db",
        AA_DEPLOYMENT_ROLLOUT_STRATEGY: "invalid",
    }), /invalid_env:AA_DEPLOYMENT_ROLLOUT_STRATEGY/);
});
test("loadDeploymentExecutionCliEnv rejects invalid runner mode", () => {
    assert.throws(() => loadDeploymentExecutionCliEnv({
        AA_DB_PATH: "/tmp/db",
        AA_DEPLOYMENT_RUNNER_MODE: "invalid",
    }), /invalid_env:AA_DEPLOYMENT_RUNNER_MODE/);
});
test("loadDeploymentExecutionCliEnv requires AA_DB_PATH", () => {
    assert.throws(() => loadDeploymentExecutionCliEnv({}), /missing_env:AA_DB_PATH/);
});
test("loadDeploymentExecutionCliEnv execute flag false when not set", () => {
    const config = loadDeploymentExecutionCliEnv({
        AA_DB_PATH: "/tmp/db",
    });
    assert.equal(config.execute, false);
});
test("loadDeploymentExecutionCliEnv accepts all valid rollout strategies", () => {
    const strategies = ["rolling", "canary", "blue_green"];
    for (const strategy of strategies) {
        const config = loadDeploymentExecutionCliEnv({
            AA_DB_PATH: "/tmp/db",
            AA_DEPLOYMENT_ROLLOUT_STRATEGY: strategy,
        });
        assert.equal(config.rolloutStrategy, strategy);
    }
});
test("loadDeploymentExecutionCliEnv uses process.cwd as default repo root", () => {
    const config = loadDeploymentExecutionCliEnv({
        AA_DB_PATH: "/tmp/db",
    });
    assert.equal(config.repoRootDir, process.cwd());
});
//# sourceMappingURL=deployment-execution-cli-env.test.js.map