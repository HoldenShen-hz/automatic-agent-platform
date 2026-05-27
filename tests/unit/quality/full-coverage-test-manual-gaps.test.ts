import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const MANUAL_PATH = join(ROOT, "docs_zh", "quality", "00-full-coverage-test-manual.md");
const PACKAGE_JSON_PATH = join(ROOT, "package.json");
const COVERAGE_BASELINE_PATH = join(ROOT, ".coverage-baseline.json");

type GapEvidence = {
  readonly id: string;
  readonly topic: string;
  readonly runtime: readonly string[];
  readonly tests: readonly string[];
};

const GAP_EVIDENCE: readonly GapEvidence[] = [
  {
    id: "T-GAP-01",
    topic: "UI 六平台测试",
    runtime: ["ui/apps/web/src/App.tsx", "ui/apps/electron-win/src/main.ts", "ui/apps/mobile/src/App.tsx"],
    tests: ["ui/tests/apps/web-e2e-smoke.test.tsx", "ui/tests/apps/shells.test.ts", "tests/integration/ui/apps.integration.test.ts"],
  },
  {
    id: "T-GAP-02",
    topic: "PlatformAdapter 真实集成",
    runtime: ["ui/packages/shared/platform/src/web-platform-adapter.ts", "ui/packages/shared/platform/src/desktop-platform-adapter.ts", "ui/packages/shared/platform/src/mobile-platform-adapter.ts"],
    tests: ["ui/tests/shared/platform.test.ts", "ui/tests/shared/native-modules.test.ts", "tests/unit/ui/shared/platform/platform-adapter-security.test.ts"],
  },
  {
    id: "T-GAP-03",
    topic: "Mission 长期目标治理",
    runtime: ["src/platform/five-plane-control-plane/mission/index.ts", "src/platform/five-plane-interface/api/http-server/mission-routes.ts", "src/platform/five-plane-state-evidence/truth/mission-repository.ts"],
    tests: ["tests/unit/platform/contracts/mission-contracts.test.ts", "tests/unit/platform/control-plane/mission-services.test.ts", "tests/integration/platform/interface/api/mission-task-binding.test.ts", "tests/unit/quality/full-coverage-real-paths.test.ts"],
  },
  {
    id: "T-GAP-04",
    topic: "Yono Business 业务域",
    runtime: ["src/domains/yono/index.ts", "src/domains/yono/yono-model.ts", "src/platform/five-plane-interface/api/http-server/yono-routes.ts"],
    tests: ["tests/unit/domains/yono/yono-domain.test.ts", "tests/integration/platform/interface/api/yono-routes.test.ts", "tests/unit/quality/full-coverage-real-paths.test.ts"],
  },
  {
    id: "T-GAP-05",
    topic: "LLM/Prompt/Eval 行为测试",
    runtime: ["src/platform/prompt-engine/eval/llm-eval-service.ts", "src/platform/prompt-engine/prompt-injection-guard.ts", "src/platform/model-gateway/provider-registry/model-routing-service.ts"],
    tests: ["tests/integration/platform/prompt-engine/eval/evaluation-integration.test.ts", "tests/e2e/prompt-injection-guard-e2e.test.ts", "tests/golden/prompt-assembly.test.ts", "tests/unit/quality/full-coverage-real-paths.test.ts"],
  },
  {
    id: "T-GAP-06",
    topic: "API 契约兼容与版本演进",
    runtime: ["src/platform/five-plane-interface/api/http-server/mission-routes.ts", "src/sdk/client-sdk/api-client.ts"],
    tests: ["tests/golden/openapi-document.test.ts", "tests/integration/platform/contracts/api-openapi-contract.test.ts", "tests/unit/sdk/api-client.test.ts"],
  },
  {
    id: "T-GAP-07",
    topic: "数据迁移与升级回滚",
    runtime: ["src/platform/five-plane-state-evidence/truth/migration-runner.ts", "scripts/backup-sqlite.sh", "scripts/restore-sqlite.sh"],
    tests: ["tests/integration/platform/state-evidence/truth/migration/upgrade-migration.test.ts", "tests/integration/platform/state-evidence/truth/migration/rollback-migration.test.ts", "tests/integration/platform/execution/stable-backup-restore-rehearsal.test.ts"],
  },
  {
    id: "T-GAP-08",
    topic: "Chaos / 故障注入",
    runtime: ["src/ops-maturity/chaos/chaos-experiment-scheduler.ts", "src/ops-maturity/chaos/chaos-experiment-types.ts"],
    tests: ["tests/unit/ops-maturity/chaos/chaos-experiment-scheduler.test.ts", "tests/integration/ops-maturity/chaos.integration.test.ts", "tests/e2e/ops-maturity/chaos-drift-e2e.test.ts", "tests/unit/quality/full-coverage-operational-real-paths.test.ts"],
  },
  {
    id: "T-GAP-09",
    topic: "灾备与多区域演练",
    runtime: ["src/scale-ecosystem/multi-region/failover-controller/index.ts", "src/platform/stability/dr-drill-gate.ts", ".github/workflows/dr-validation.yml"],
    tests: ["tests/unit/platform/stability/dr-drill-gate.test.ts", "tests/e2e/multi-region-failover.test.ts", "tests/e2e/failover-flow.test.ts", "tests/unit/quality/full-coverage-operational-real-paths.test.ts"],
  },
  {
    id: "T-GAP-10",
    topic: "可观测性语义测试",
    runtime: ["src/platform/shared/observability/prometheus-metrics-exporter.ts", "src/platform/shared/observability/structured-logger.ts", "src/platform/shared/observability/otel-tracer.ts"],
    tests: ["tests/integration/platform/shared/observability/metrics-service.test.ts", "tests/integration/platform/shared/observability/structured-logging-integration.test.ts", "tests/golden/metrics-service-output.test.ts", "tests/unit/quality/full-coverage-operational-real-paths.test.ts"],
  },
  {
    id: "T-GAP-11",
    topic: "成本与预算防线",
    runtime: ["src/platform/model-gateway/cost-tracker/budget-guard.ts", "src/platform/five-plane-execution/budget-allocator.ts"],
    tests: ["tests/integration/platform/model-gateway/cost-tracker-budget-guard.test.ts", "tests/invariants/budget-reserve-before-execute.test.ts", "tests/e2e/budget-execution-blocking-e2e.test.ts", "tests/unit/quality/full-coverage-real-paths.test.ts"],
  },
  {
    id: "T-GAP-12",
    topic: "隐私、数据保留与脱敏",
    runtime: ["src/platform/shared/observability/observability-retention-service.ts", "src/sdk/fixture-redact.ts", "src/platform/five-plane-control-plane/incident-control/tenant-execution-isolation-service.ts"],
    tests: ["tests/unit/ops-maturity/compliance-reporter/pii-redaction-and-auditor-access.test.ts", "tests/integration/platform/security/data-leakage-prevention.test.ts", "tests/e2e/tenant-isolation-flow.test.ts", "tests/unit/quality/full-coverage-operational-real-paths.test.ts"],
  },
  {
    id: "T-GAP-13",
    topic: "插件/Pack 生态兼容",
    runtime: ["src/domains/business-pack/pack-migration-service.ts", "src/sdk/plugin-sdk/plugin-definition.ts", "src/plugins/index.ts"],
    tests: ["tests/integration/sdk/pack-plugin-compatibility-integration.test.ts", "tests/unit/plugins/plugin-definition-security-regressions.test.ts", "tests/integration/plugins/plugin-execution-integration.test.ts"],
  },
  {
    id: "T-GAP-14",
    topic: "供应链与依赖治理",
    runtime: ["scripts/ci/audit-ci-supply-chain.mjs", "package-lock.json"],
    tests: ["tests/unit/sdk/plugin-sdk-signature-sbom.test.ts", "tests/unit/domains/supply-chain/index.test.ts", "tests/unit/quality/full-coverage-operational-real-paths.test.ts"],
  },
  {
    id: "T-GAP-15",
    topic: "性能容量与资源泄漏",
    runtime: ["src/platform/shared/cache/cache-metrics.ts", "src/platform/five-plane-execution/queue-metrics/index.ts"],
    tests: ["tests/performance/platform/execution/budget-allocator-perf.test.ts", "tests/leaks/platform/shared/cache/memory-cache-store.leak.test.ts", "tests/leaks/platform/state-evidence/events/durable-event-bus.leak.test.ts"],
  },
  {
    id: "T-GAP-16",
    topic: "并行测试隔离与 flakiness 治理",
    runtime: ["scripts/run-layered-tests.mjs", "scripts/run-tracked-tests.mjs"],
    tests: ["tests/invariants/e2e-skip-guard.test.ts", "tests/unit/testing/api-context.test.ts"],
  },
  {
    id: "T-GAP-17",
    topic: "配置组合矩阵",
    runtime: ["src/platform/five-plane-control-plane/config-center/startup-env-schema.ts", "deploy/helm/automatic-agent/values-prod.yaml", "deploy/terraform/environments/prod.tfvars"],
    tests: ["tests/unit/platform/control-plane/config-center/startup-env-schema.test.ts", "tests/golden/deploy/helm-ingress-guardrails.test.ts", "tests/e2e/config-governance-e2e.test.ts", "tests/unit/quality/full-coverage-operational-real-paths.test.ts"],
  },
  {
    id: "T-GAP-18",
    topic: "Accessibility / i18n / Theme",
    runtime: ["ui/lighthouserc.mjs", "ui/packages/shared/i18n/src/index.ts", "ui/packages/ui-core/src/themes/index.ts"],
    tests: ["ui/tests/a11y/web-accessibility.spec.ts", "ui/tests/shared/accessibility-regression-baseline.test.tsx", "ui/tests/features/feature-i18n.test.ts"],
  },
  {
    id: "T-GAP-19",
    topic: "文档健康与示例可执行性",
    runtime: ["docs_zh/README.md", "docs_zh/quality/00-full-coverage-test-manual.md"],
    tests: ["tests/unit/docs/documentation-health.test.ts", "tests/integration/docs/architecture-consistency.test.ts"],
  },
  {
    id: "T-GAP-20",
    topic: "Property-based / fuzz 测试",
    runtime: ["src/sdk/client-sdk/api-client.ts", "src/platform/five-plane-execution/state-transition/transition-service-model.ts"],
    tests: ["tests/unit/sdk/api-client.test.ts", "tests/invariants/state-transition-service-invariants.test.ts", "tests/invariants/truth-event-atomicity.test.ts"],
  },
];

function readManual(): string {
  return readFileSync(MANUAL_PATH, "utf8");
}

function extractIds(markdown: string, prefix: "T-GAP" | "GA"): string[] {
  const pattern = new RegExp(`\\| (${prefix}-\\d{2}) \\|`, "g");
  return Array.from(markdown.matchAll(pattern), (match) => match[1]!).sort();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function assertPathsExist(paths: readonly string[], label: string): void {
  const missing = paths.filter((path) => !existsSync(join(ROOT, path)));
  assert.deepEqual(missing, [], `${label} missing evidence paths`);
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function listFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") {
        continue;
      }
      files.push(...listFiles(fullPath));
      continue;
    }
    if (entry.isFile() && /\.(?:test|spec)\.tsx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function readEvidenceSource(path: string): string {
  return stripComments(readFileSync(join(ROOT, path), "utf8"));
}

test("quality manual Part V keeps the full T-GAP and GA acceptance inventory", () => {
  const manual = readManual();

  const gapIds = unique(extractIds(manual, "T-GAP"));
  assert.deepEqual(
    gapIds,
    Array.from({ length: 20 }, (_, index) => `T-GAP-${String(index + 1).padStart(2, "0")}`),
  );

  const gaIds = unique(extractIds(manual, "GA"));
  assert.deepEqual(
    gaIds,
    Array.from({ length: 15 }, (_, index) => `GA-${String(index + 1).padStart(2, "0")}`),
  );
});

test("quality manual T-GAP items have concrete runtime and automated-test evidence", () => {
  const manual = readManual();
  const idsInManual = new Set(extractIds(manual, "T-GAP"));
  const idsWithEvidence = unique(GAP_EVIDENCE.map((item) => item.id));

  assert.deepEqual(idsWithEvidence, unique([...idsInManual]));

  for (const item of GAP_EVIDENCE) {
    assert.match(manual, new RegExp(`${item.id} \\| ${item.topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assertPathsExist(item.runtime, `${item.id} runtime`);
    assertPathsExist(item.tests, `${item.id} tests`);
  }
});

test("quality manual T-GAP automated evidence is executable and assertion-bearing", () => {
  for (const item of GAP_EVIDENCE) {
    for (const testPath of item.tests) {
      const source = readEvidenceSource(testPath);
      assert.match(source, /\b(?:test|it)\s*\(/, `${item.id} evidence ${testPath} must define executable tests`);
      assert.match(
        source,
        /\b(?:assert\.[A-Za-z]+|expect\s*\()/,
        `${item.id} evidence ${testPath} must contain assertions or expectations`,
      );
    }
  }
});

test("quality manual critical test suites do not use skip markers", () => {
  const testFiles = [
    ...listFiles(join(ROOT, "tests")),
    ...listFiles(join(ROOT, "ui", "tests")),
  ];
  const violations: string[] = [];

  for (const filePath of testFiles) {
    const source = stripComments(readFileSync(filePath, "utf8"));
    if (/\b(?:test|it|describe)\.skip\s*\(|\bt\.skip\s*\(/.test(source)) {
      violations.push(filePath.replace(`${ROOT}/`, ""));
    }
  }

  assert.deepEqual(violations, [], `skip markers require explicit approval and registry entries: ${violations.join(", ")}`);
});

test("UI feature packages keep web, mobile, and hooks testable entrypoints", () => {
  const featureRoot = join(ROOT, "ui", "packages", "features");
  const featureNames = readdirSync(featureRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.ok(featureNames.length >= 20, "UI feature catalog should include the product feature set");

  for (const featureName of featureNames) {
    for (const relativeEntry of ["src/web/index.tsx", "src/mobile/index.ts", "src/hooks/index.ts"]) {
      const fullPath = join(featureRoot, featureName, relativeEntry);
      assert.ok(existsSync(fullPath), `${featureName} missing ${relativeEntry}`);
      assert.match(readFileSync(fullPath, "utf8"), /\bexport\b/, `${featureName}/${relativeEntry} must expose a public entrypoint`);
    }
  }
});

test("quality manual execution route is backed by runnable repository scripts", () => {
  const manual = readManual();
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as {
    readonly scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};

  for (const requiredScript of [
    "test",
    "test:unit",
    "test:integration",
    "test:e2e",
    "test:golden",
    "test:performance",
    "test:leaks",
    "test:invariants",
    "coverage:report",
    "coverage:gate",
    "test:mutation",
  ]) {
    assert.ok(scripts[requiredScript], `missing npm script required by the quality manual: ${requiredScript}`);
  }

  for (const route of ["P0-1", "P0-7", "P1-1", "P1-6", "P2-4"]) {
    assert.match(manual, new RegExp(`\\| ${route} \\|`), `manual should keep execution route ${route}`);
  }
});

test("coverage baseline is non-empty and keeps src directories under gate", () => {
  const baseline = JSON.parse(readFileSync(COVERAGE_BASELINE_PATH, "utf8")) as {
    readonly global?: Record<string, number>;
    readonly minimums?: Record<string, number>;
    readonly directories?: Record<string, unknown>;
  };

  assert.ok(baseline.global, "coverage baseline must include global metrics");
  assert.ok(baseline.minimums, "coverage baseline must include minimum metrics");
  assert.ok(baseline.directories, "coverage baseline must include directory metrics");
  assert.ok(Object.keys(baseline.directories).some((dir) => dir.startsWith("src/")), "coverage baseline must track src/ directories");

  for (const metric of ["lines", "statements", "functions", "branches"]) {
    assert.equal(typeof baseline.global[metric], "number", `global ${metric} baseline must be numeric`);
    assert.equal(typeof baseline.minimums[metric], "number", `minimum ${metric} baseline must be numeric`);
  }
});
