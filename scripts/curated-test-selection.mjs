import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const EXCLUDED_PREFIXES = [
  "tests/e2e/",
  "tests/e2e/platform/interface/",
  "tests/integration/domains/governance/",
  "tests/integration/interaction/",
  "tests/integration/org-governance/",
  "tests/integration/platform/control-plane/",
  "tests/integration/platform/execution/",
  "tests/integration/platform/interface/",
  "tests/integration/platform/orchestration/",
  "tests/integration/platform/five-plane-orchestration/",
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
  "tests/integration/platform/state-evidence/truth/",
  "tests/integration/testing/",
  "tests/integration/ui/",
  "tests/leaks/",
  "tests/performance/",
  "tests/unit/interaction/",
  "tests/unit/ops-maturity/",
  "tests/unit/platform/execution/",
  "tests/unit/org-governance/knowledge-boundary/",
  "tests/unit/platform/cost-management/",
  "tests/unit/platform/five-plane-control-plane/",
  "tests/unit/platform/five-plane-orchestration/",
  "tests/unit/platform/five-plane-state-evidence/artifacts/",
  "tests/unit/platform/interaction/",
  "tests/unit/platform/interface/",
  "tests/unit/platform/model-gateway/",
  "tests/unit/platform/observability/",
  "tests/unit/platform/ops-maturity/",
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
  "tests/unit/scripts/",
  "tests/unit/testing/",
  "tests/unit/helpers/",
  "tests/unit/ui/",
  "tests/golden/",
];

const INCLUDED_PREFIXES = [
  "tests/unit/platform/state-evidence/truth/sqlite/repositories/",
];

const INCLUDED_FILES = new Set([
  "tests/integration/platform/interface/api/mission-routes.test.ts",
  "tests/integration/platform/interface/api/mission-task-binding.test.ts",
]);

const EXCLUDED_FILES = new Set([
  "tests/e2e/execution-ticket-lifecycle.test.ts",
  "tests/e2e/metrics-collection-flow.test.ts",
  "tests/e2e/multi-region-failover.test.ts",
  "tests/e2e/task-status-lifecycle.test.ts",
  "tests/e2e/workflow-state-transitions.test.ts",
  "tests/e2e/workflow-timeout-flow.test.ts",
  "tests/integration/platform/interface/console-backend.test.ts",
  "tests/integration/platform/interface/scheduler.test.ts",
  "tests/integration/sdk/admin-sdk-integration.test.ts",
  "tests/integration/sdk/client-sdk-integration-extended.test.ts",
  "tests/integration/sdk/cli/billing-cli.test.ts",
  "tests/integration/sdk/migrate-sqlite-to-pg-integration-2278-2279.test.ts",
  "tests/integration/cross-plane-event-propagation.test.ts",
  "tests/unit/domains/registry/domain-model-validation.test.ts",
  "tests/unit/platform/contracts/coverage-baseline-guard.test.ts",
  "tests/unit/platform/structure/directory-structure.test.ts",
  "tests/unit/platform/shared/lifecycle/evolution-mvp-assert-scope.test.ts",
  "tests/unit/platform/shared/lifecycle/evolution-mvp-helpers-edge.test.ts",
  "tests/unit/platform/shared/lifecycle/service-registry-bootstrap-replay.test.ts",
  "tests/unit/platform/shared/lifecycle/service-registry-circular-get.test.ts",
  "tests/unit/platform/shared/lifecycle/service-registry-extra.test.ts",
  "tests/unit/platform/service-registry-projections.test.ts",
  "tests/unit/plugins/growth-config.test.ts",
  "tests/unit/plugins/operations-config.test.ts",
  "tests/unit/root-entry-summary.test.ts",
  "tests/unit/scale-ecosystem/cdc-replication-service.test.ts",
  "tests/unit/scale-ecosystem/pack-security-service.test.ts",
  "tests/unit/scale-ops-runtime-catalog.test.ts",
  "tests/unit/sdk/admin-sdk-e2e.test.ts",
  "tests/unit/sdk/cli/dlq-manager-operations-2282-2283.test.ts",
  "tests/unit/sdk/cli/model-routing.test.ts",
  "tests/unit/sdk/cli/shadow-snapshot.test.ts",
  "tests/unit/sdk/pack-sdk/pack-lifecycle-edge-cases.test.ts",
  "tests/unit/sdk/pack-sdk/pack-test-local-service-edge-cases.test.ts",
  "tests/unit/docs/adr/adr-018-superseded-history.test.ts",
  "tests/unit/platform/orchestration/escalation/escalation-state-machine.test.ts",
  "tests/unit/platform/orchestration/harness/replay-worker.test.ts",
  "tests/unit/scripts/coverage-lib.test.ts",
]);

function listFilesRecursively(rootPath) {
  if (!existsSync(rootPath)) {
    return [];
  }

  const pending = [rootPath];
  const results = [];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current == null || !existsSync(current)) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }
      results.push(fullPath);
    }
  }
  return results;
}

function normalizeRelativeTestPath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/\.js$/, ".ts");
}

export function shouldIncludeCuratedTest(relativePath) {
  const normalizedPath = normalizeRelativeTestPath(relativePath);
  if (INCLUDED_FILES.has(normalizedPath)) {
    return true;
  }
  if (INCLUDED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return true;
  }
  if (EXCLUDED_FILES.has(normalizedPath)) {
    return false;
  }
  return !EXCLUDED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}

export function listCuratedSourceTests(repoRoot = process.cwd()) {
  const testsRoot = resolve(repoRoot, "tests");
  return listFilesRecursively(testsRoot)
    .filter((filePath) => filePath.endsWith(".test.ts"))
    .filter((filePath) => shouldIncludeCuratedTest(relative(repoRoot, filePath)));
}

export function listCuratedCompiledTests(distRoot = resolve(process.cwd(), "dist")) {
  const distTestsRoot = join(distRoot, "tests");
  return listFilesRecursively(distTestsRoot)
    .filter((filePath) => filePath.endsWith(".test.js"))
    .filter((filePath) => shouldIncludeCuratedTest(relative(distRoot, filePath)))
    .map((filePath) => join(distRoot, relative(distRoot, filePath)));
}
