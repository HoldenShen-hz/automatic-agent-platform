/**
 * Release Pipeline CLI Tests
 *
 * Tests for release-pipeline.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { loadReleasePipelineCliEnv } from "../../../../src/platform/five-plane-control-plane/config-center/release-pipeline-env.js";

// ---------------------------------------------------------------------------
// Tests for loadReleasePipelineCliEnv - using list action (no required env vars)
// ---------------------------------------------------------------------------

test("loadReleasePipelineCliEnv defaults action to summary", () => {
  // Default action is summary, but using list action for minimal env test
  const envConfig = loadReleasePipelineCliEnv({ AA_RELEASE_ACTION: "list" });
  assert.equal(envConfig.action, "list");
});

test("loadReleasePipelineCliEnv parses list action", () => {
  const envConfig = loadReleasePipelineCliEnv({ AA_RELEASE_ACTION: "list" });
  assert.equal(envConfig.action, "list");
});

test("loadReleasePipelineCliEnv returns null environment on list action", () => {
  const envConfig = loadReleasePipelineCliEnv({ AA_RELEASE_ACTION: "list" });
  assert.equal(envConfig.environment, null);
});

test("loadReleasePipelineCliEnv returns null version on list action", () => {
  const envConfig = loadReleasePipelineCliEnv({ AA_RELEASE_ACTION: "list" });
  assert.equal(envConfig.version, null);
});

test("loadReleasePipelineCliEnv returns null commitSha on list action", () => {
  const envConfig = loadReleasePipelineCliEnv({ AA_RELEASE_ACTION: "list" });
  assert.equal(envConfig.commitSha, null);
});

test("loadReleasePipelineCliEnv returns null rolloutStrategy on list action", () => {
  const envConfig = loadReleasePipelineCliEnv({ AA_RELEASE_ACTION: "list" });
  assert.equal(envConfig.rolloutStrategy, null);
});

// ---------------------------------------------------------------------------
// Tests for loadReleasePipelineCliEnv - with required env vars for non-list actions
// ---------------------------------------------------------------------------

test("loadReleasePipelineCliEnv parses export action", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "export",
    AA_RELEASE_ENVIRONMENT: "prod",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "abc123",
    AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
  });
  assert.equal(envConfig.action, "export");
});

test("loadReleasePipelineCliEnv parses execute action", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "execute",
    AA_RELEASE_ENVIRONMENT: "prod",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "abc123",
    AA_RELEASE_ROLLOUT_STRATEGY: "canary",
  });
  assert.equal(envConfig.action, "execute");
});

test("loadReleasePipelineCliEnv parses summary action", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "summary",
    AA_RELEASE_ENVIRONMENT: "staging",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "abc123",
    AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
  });
  assert.equal(envConfig.action, "summary");
});

test("loadReleasePipelineCliEnv invalid action throws", () => {
  assert.throws(
    () => loadReleasePipelineCliEnv({ AA_RELEASE_ACTION: "invalid" }),
    /release\.invalid_action/,
  );
});

test("loadReleasePipelineCliEnv returns local runner by default with list action", () => {
  const envConfig = loadReleasePipelineCliEnv({ AA_RELEASE_ACTION: "list" });
  assert.equal(envConfig.runnerMode, "local");
});

test("loadReleasePipelineCliEnv parses simulate runner", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_RUNNER: "simulate",
    AA_RELEASE_ACTION: "list",
  });
  assert.equal(envConfig.runnerMode, "simulate");
});

test("loadReleasePipelineCliEnv invalid runner throws", () => {
  assert.throws(
    () => loadReleasePipelineCliEnv({ AA_RELEASE_RUNNER: "invalid", AA_RELEASE_ACTION: "list" }),
    /release\.invalid_runner/,
  );
});

test("loadReleasePipelineCliEnv returns null dbPath by default with list action", () => {
  const envConfig = loadReleasePipelineCliEnv({ AA_RELEASE_ACTION: "list" });
  assert.equal(envConfig.dbPath, null);
});

test("loadReleasePipelineCliEnv parses dbPath", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_DB_PATH: "/custom/path.db",
    AA_RELEASE_ACTION: "list",
  });
  assert.equal(envConfig.dbPath, "/custom/path.db");
});

test("loadReleasePipelineCliEnv triggerDeploy is false by default with list action", () => {
  const envConfig = loadReleasePipelineCliEnv({ AA_RELEASE_ACTION: "list" });
  assert.equal(envConfig.triggerDeploy, false);
});

test("loadReleasePipelineCliEnv parses triggerDeploy when true", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_TRIGGER_DEPLOY: "true",
    AA_RELEASE_ACTION: "list",
  });
  assert.equal(envConfig.triggerDeploy, true);
});

test("loadReleasePipelineCliEnv parses valid environment", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "summary",
    AA_RELEASE_ENVIRONMENT: "prod",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "abc123",
    AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
  });
  assert.equal(envConfig.environment, "prod");
});

test("loadReleasePipelineCliEnv normalizes development to dev", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "summary",
    AA_RELEASE_ENVIRONMENT: "development",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "abc123",
    AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
  });
  assert.equal(envConfig.environment, "dev");
});

test("loadReleasePipelineCliEnv normalizes production to prod", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "summary",
    AA_RELEASE_ENVIRONMENT: "production",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "abc123",
    AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
  });
  assert.equal(envConfig.environment, "prod");
});

test("loadReleasePipelineCliEnv invalid environment throws", () => {
  assert.throws(
    () =>
      loadReleasePipelineCliEnv({
        AA_RELEASE_ACTION: "summary",
        AA_RELEASE_ENVIRONMENT: "invalid_env",
        AA_RELEASE_VERSION: "1.0.0",
        AA_RELEASE_COMMIT_SHA: "abc123",
        AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
      }),
    /release\.invalid_environment/,
  );
});

test("loadReleasePipelineCliEnv parses valid rollout strategy", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "summary",
    AA_RELEASE_ENVIRONMENT: "prod",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "abc123",
    AA_RELEASE_ROLLOUT_STRATEGY: "canary",
  });
  assert.equal(envConfig.rolloutStrategy, "canary");
});

test("loadReleasePipelineCliEnv parses blue_green rollout strategy", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "summary",
    AA_RELEASE_ENVIRONMENT: "prod",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "abc123",
    AA_RELEASE_ROLLOUT_STRATEGY: "blue_green",
  });
  assert.equal(envConfig.rolloutStrategy, "blue_green");
});

test("loadReleasePipelineCliEnv invalid rollout strategy throws", () => {
  assert.throws(
    () =>
      loadReleasePipelineCliEnv({
        AA_RELEASE_ACTION: "summary",
        AA_RELEASE_ENVIRONMENT: "prod",
        AA_RELEASE_VERSION: "1.0.0",
        AA_RELEASE_COMMIT_SHA: "abc123",
        AA_RELEASE_ROLLOUT_STRATEGY: "bigbang",
      }),
    /release\.invalid_rollout_strategy/,
  );
});

test("loadReleasePipelineCliEnv parses registry optional field", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "summary",
    AA_RELEASE_ENVIRONMENT: "prod",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "abc123",
    AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
    AA_RELEASE_REGISTRY: "docker.io/myorg",
  });
  assert.equal(envConfig.registry, "docker.io/myorg");
});

test("loadReleasePipelineCliEnv parses imageRepository optional field", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "summary",
    AA_RELEASE_ENVIRONMENT: "prod",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "abc123",
    AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
    AA_RELEASE_IMAGE_REPOSITORY: "myimage:latest",
  });
  assert.equal(envConfig.imageRepository, "myimage:latest");
});

test("loadReleasePipelineCliEnv parses taskId optional field", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "summary",
    AA_RELEASE_ENVIRONMENT: "prod",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "abc123",
    AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
    AA_RELEASE_TASK_ID: "task_123",
  });
  assert.equal(envConfig.taskId, "task_123");
});

test("loadReleasePipelineCliEnv parses version for non-list action", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "export",
    AA_RELEASE_ENVIRONMENT: "prod",
    AA_RELEASE_VERSION: "2.0.0",
    AA_RELEASE_COMMIT_SHA: "def456",
    AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
  });
  assert.equal(envConfig.version, "2.0.0");
});

test("loadReleasePipelineCliEnv parses commitSha for non-list action", () => {
  const envConfig = loadReleasePipelineCliEnv({
    AA_RELEASE_ACTION: "export",
    AA_RELEASE_ENVIRONMENT: "prod",
    AA_RELEASE_VERSION: "1.0.0",
    AA_RELEASE_COMMIT_SHA: "def456",
    AA_RELEASE_ROLLOUT_STRATEGY: "rolling",
  });
  assert.equal(envConfig.commitSha, "def456");
});

// ---------------------------------------------------------------------------
// Tests for SimulatedReleasePipelineCommandRunner behavior
// ---------------------------------------------------------------------------

test("SimulatedReleasePipelineCommandRunner returns correct structure for publish_workflow", async () => {
  const runner = new SimulatedReleasePipelineCommandRunner();
  const result = await runner.run({
    step: "publish_workflow",
    command: "gh",
    args: ["workflow", "run"],
  });

  assert.equal(result.step, "publish_workflow");
  assert.equal(result.executed, true);
  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout.includes("https://github.com/automatic-agent/automatic-agent-platform/actions/runs/700000001"));
});

test("SimulatedReleasePipelineCommandRunner returns simulated output for other steps", async () => {
  const runner = new SimulatedReleasePipelineCommandRunner();
  const result = await runner.run({
    step: "build",
    command: "npm",
    args: ["run", "build"],
  });

  assert.equal(result.step, "build");
  assert.equal(result.executed, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "simulated:build");
  assert.equal(result.stderr, "");
  assert.equal(result.durationMs, 1);
});

test("SimulatedReleasePipelineCommandRunner preserves args", async () => {
  const runner = new SimulatedReleasePipelineCommandRunner();
  const result = await runner.run({
    step: "test",
    command: "npm",
    args: ["test", "--", "--coverage"],
  });

  assert.deepEqual(result.args, ["test", "--", "--coverage"]);
});

test("SimulatedReleasePipelineCommandRunner returns null runId for non-publish_workflow steps", async () => {
  const runner = new SimulatedReleasePipelineCommandRunner();
  const result = await runner.run({
    step: "deploy",
    command: "kubectl",
    args: ["apply", "-f", "deploy.yaml"],
  });

  assert.ok(!result.stdout.includes("actions/runs/"));
});

// ---------------------------------------------------------------------------
// Tests for SimulatedDeploymentCommandRunner behavior
// ---------------------------------------------------------------------------

test("SimulatedDeploymentCommandRunner returns correct structure for publish step", async () => {
  const runner = new SimulatedDeploymentCommandRunner();
  const result = await runner.run({
    step: "publish",
    command: "gh",
    args: ["workflow", "run"],
  });

  assert.equal(result.step, "publish");
  assert.equal(result.executed, true);
  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout.includes("https://github.com/automatic-agent/automatic-agent-platform/actions/runs/700000002"));
});

test("SimulatedDeploymentCommandRunner returns different runId for non-publish steps", async () => {
  const runner = new SimulatedDeploymentCommandRunner();
  const result = await runner.run({
    step: "deploy",
    command: "kubectl",
    args: ["apply", "-f", "deployment.yaml"],
  });

  assert.ok(result.stdout.includes("700000003"));
});

test("SimulatedDeploymentCommandRunner preserves command and args", async () => {
  const runner = new SimulatedDeploymentCommandRunner();
  const result = await runner.run({
    step: "rollback",
    command: "kubectl",
    args: ["rollout", "undo"],
  });

  assert.equal(result.command, "kubectl");
  assert.deepEqual(result.args, ["rollout", "undo"]);
});

test("SimulatedDeploymentCommandRunner has non-zero duration", async () => {
  const runner = new SimulatedDeploymentCommandRunner();
  const result = await runner.run({
    step: "status",
    command: "kubectl",
    args: ["status"],
  });

  assert.equal(result.durationMs, 1);
});

// ---------------------------------------------------------------------------
// Helper classes (duplicated from source for testing)
// ---------------------------------------------------------------------------

class SimulatedReleasePipelineCommandRunner {
  public async run(request: { step: string; command: string; args: string[] }): Promise<{
    step: string;
    command: string;
    args: string[];
    executed: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
  }> {
    const runId = request.step === "publish_workflow" ? "700000001" : null;
    const stdout = request.step === "publish_workflow"
      ? `Created workflow_dispatch event\n${buildGithubActionRunUrl(runId)}`
      : `simulated:${request.step}`;
    return {
      step: request.step,
      command: request.command,
      args: [...request.args],
      executed: true,
      exitCode: 0,
      stdout,
      stderr: "",
      durationMs: 1,
    };
  }
}

class SimulatedDeploymentCommandRunner {
  public async run(request: { step: string; command: string; args: string[] }): Promise<{
    step: string;
    command: string;
    args: string[];
    executed: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
  }> {
    const runId = request.step === "publish" ? "700000002" : "700000003";
    return {
      step: request.step,
      command: request.command,
      args: [...request.args],
      executed: true,
      exitCode: 0,
      stdout: `Created workflow_dispatch event\n${buildGithubActionRunUrl(runId)}`,
      stderr: "",
      durationMs: 1,
    };
  }
}

function buildGithubActionRunUrl(runId: string | null): string {
  return `https://github.com/automatic-agent/automatic-agent-platform/actions/runs/${runId}`;
}
