import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const distRoot = resolve(process.cwd(), "dist");
const distTestsRoot = join(distRoot, "tests");
const defaultConcurrency = readPositiveInteger("AA_CURATED_TEST_CONCURRENCY", 1);
const testMaxOldSpaceSizeMb = readOptionalPositiveInteger("AA_TEST_MAX_OLD_SPACE_MB", 1536);

const EXCLUDED_PREFIXES = [
  "tests/integration/domains/governance/",
  "tests/integration/interaction/",
  "tests/integration/org-governance/",
  "tests/integration/platform/control-plane/",
  "tests/integration/platform/execution/",
  "tests/integration/platform/interface/channel-gateway/",
  "tests/integration/platform/interface/console-backend/",
  "tests/integration/platform/interface/scheduler/",
  "tests/integration/platform/model-gateway/",
  "tests/integration/platform/security/",
  "tests/integration/platform/shared/cache/",
  "tests/integration/platform/shared/stability/",
  "tests/integration/platform/state-evidence/events/",
  "tests/integration/platform/state-evidence/knowledge/",
  "tests/integration/platform/state-evidence/memory/",
  "tests/unit/interaction/",
  "tests/unit/ops-maturity/",
  "tests/unit/org-governance/knowledge-boundary/",
  "tests/unit/platform/architecture/",
  "tests/unit/platform/contracts/delegation-request/",
  "tests/unit/platform/contracts/prompt-bundle/",
  "tests/unit/platform/cost-management/",
  "tests/unit/platform/interaction/",
  "tests/unit/platform/interface/",
  "tests/unit/platform/model-gateway/",
  "tests/unit/platform/observability/",
  "tests/unit/platform/ops-maturity/",
  "tests/unit/platform/orchestration/",
  "tests/unit/platform/scale-ecosystem/",
  "tests/unit/platform/shared/cache/",
  "tests/unit/platform/shared/observability/",
  "tests/unit/platform/shared/outbox/",
  "tests/unit/platform/shared/scaling/",
  "tests/unit/platform/shared/stability/",
  "tests/unit/platform/stability/",
  "tests/unit/platform/state-evidence/checkpoints/",
  "tests/unit/platform/state-evidence/events/",
  "tests/unit/platform/state-evidence/truth/",
  "tests/unit/runtime/agent-runtime/",
  "tests/unit/runtime/task-runtime/",
  "tests/unit/scale-ecosystem/billing/",
  "tests/unit/scale-ecosystem/operations/",
  "tests/unit/scale-ecosystem/sla-engine/",
  "tests/unit/scale-ecosystem/tenant-platform/",
];

const EXCLUDED_FILES = new Set([
  "tests/e2e/execution-ticket-lifecycle.test.js",
  "tests/e2e/metrics-collection-flow.test.js",
  "tests/e2e/multi-region-failover.test.js",
  "tests/e2e/task-status-lifecycle.test.js",
  "tests/e2e/workflow-state-transitions.test.js",
  "tests/e2e/workflow-timeout-flow.test.js",
  "tests/integration/platform/interface/console-backend.test.js",
  "tests/integration/platform/interface/scheduler.test.js",
  "tests/integration/sdk/cli/billing-cli.test.js",
  "tests/unit/domains/registry/domain-model-validation.test.js",
  "tests/unit/platform/contracts/coverage-baseline-guard.test.js",
  "tests/unit/platform/shared/lifecycle/evolution-mvp-assert-scope.test.js",
  "tests/unit/platform/shared/lifecycle/evolution-mvp-helpers-edge.test.js",
  "tests/unit/platform/shared/lifecycle/service-registry-bootstrap-replay.test.js",
  "tests/unit/platform/shared/lifecycle/service-registry-circular-get.test.js",
  "tests/unit/platform/shared/lifecycle/service-registry-extra.test.js",
  "tests/unit/plugins/growth-config.test.js",
  "tests/unit/plugins/operations-config.test.js",
  "tests/unit/root-entry-summary.test.js",
  "tests/unit/scale-ecosystem/cdc-replication-service.test.js",
  "tests/unit/scale-ecosystem/pack-security-service.test.js",
  "tests/unit/scale-ops-runtime-catalog.test.js",
  "tests/unit/sdk/cli/model-routing.test.js",
  "tests/unit/sdk/cli/shadow-snapshot.test.js",
  "tests/unit/sdk/pack-sdk/pack-lifecycle-edge-cases.test.js",
  "tests/unit/sdk/pack-sdk/pack-test-local-service-edge-cases.test.js",
]);

function readPositiveInteger(envName, fallback) {
  const raw = process.env[envName];
  if (raw == null || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${envName} must be a positive integer, received: ${raw}`);
  }
  return parsed;
}

function readOptionalPositiveInteger(envName, fallback) {
  const raw = process.env[envName];
  if (raw == null || raw.trim().length === 0) {
    return fallback;
  }
  if (raw === "0") {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${envName} must be a positive integer or 0, received: ${raw}`);
  }
  return parsed;
}

function hasExecArg(args, prefix) {
  return args.some((arg) => arg === prefix || arg.startsWith(`${prefix}=`));
}

function listFilesRecursively(rootPath) {
  const results = [];
  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    const fullPath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursively(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

if (!existsSync(distTestsRoot)) {
  console.error("dist/tests does not exist. Run build:test first.");
  process.exit(1);
}

const selectedFiles = listFilesRecursively(distTestsRoot)
  .filter((filePath) => filePath.endsWith(".test.js"))
  .map((filePath) => relative(distRoot, filePath).replaceAll("\\", "/"))
  .filter((relativePath) => {
    if (EXCLUDED_FILES.has(relativePath)) {
      return false;
    }
    return !EXCLUDED_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
  })
  .map((relativePath) => join(distRoot, relativePath));

if (selectedFiles.length === 0) {
  console.error("No curated test files matched.");
  process.exit(1);
}

const nodeArgs = [...process.execArgv];
if (testMaxOldSpaceSizeMb != null && !hasExecArg(nodeArgs, "--max-old-space-size")) {
  nodeArgs.push(`--max-old-space-size=${testMaxOldSpaceSizeMb}`);
}

const child = spawn(process.execPath, [...nodeArgs, "--test", `--test-concurrency=${defaultConcurrency}`, ...selectedFiles], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal != null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
