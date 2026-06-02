#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const generatedAt = new Date().toISOString();
const packageJson = readJson("package.json");
const workflows = listFiles(".github/workflows", (file) => file.endsWith(".yml"));

function discoverRelativePathsByName(baseDir, targetName, kind = "directory") {
  const searchRoot = join(root, baseDir);
  if (!existsSync(searchRoot)) {
    return [];
  }
  const matches = [];
  const pending = [searchRoot];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (kind === "directory" && entry.name === targetName) {
          matches.push(relative(root, fullPath));
        }
        pending.push(fullPath);
        continue;
      }
      if (kind === "file" && entry.name === targetName) {
        matches.push(relative(root, fullPath));
      }
    }
  }
  return matches.sort((left, right) => left.localeCompare(right));
}

const capabilitySpecs = [
  {
    capability: "tool-execution-registry-boundary",
    label: "Tool execution / registry boundary",
    expectedPath: "logical Tool Gateway facade over existing execution stack",
    actualPaths: [
      ...discoverRelativePathsByName("src/platform", "tool-executor"),
      ...discoverRelativePathsByName("src/platform", "toolbelt")
    ],
    testPaths: [
      "tests/unit/platform/execution/tool-executor/",
      "tests/integration/platform/execution/tool-executor/"
    ],
    packageScripts: ["test:integration"],
    migrationMode: "wrap",
    migrationRisk: "medium",
    estimatedEffort: "L",
    recommendation: "不应先新建第二套执行栈；应在现有 tool-executor 前加 facade / contract。"
  },
  {
    capability: "policy-approval-risk",
    label: "Policy / Approval / Risk",
    expectedPath: "unified governance hook over existing control plane",
    actualPaths: [
      "src/platform/five-plane-control-plane/risk-control/",
      "src/platform/five-plane-control-plane/approval-center/",
      "src/org-governance/approval-routing/"
    ],
    testPaths: [
      "tests/integration/platform/control-plane/",
      "tests/e2e/approval-flows.test.ts"
    ],
    packageScripts: ["test:integration", "test:e2e"],
    migrationMode: "extend",
    migrationRisk: "medium",
    estimatedEffort: "L",
    recommendation: "以现有风控、审批、路由收敛为主。"
  },
  {
    capability: "event-outbox-receipt",
    label: "Event Bus / Outbox / Receipt",
    expectedPath: "receipt contract over events, outbox, and side-effect ledger",
    actualPaths: [
      "src/platform/five-plane-state-evidence/events/",
      "src/platform/shared/outbox/",
      "src/platform/five-plane-state-evidence/side-effect-ledger/"
    ],
    testPaths: [
      "tests/integration/platform/state-evidence/events/",
      "tests/unit/platform/shared/outbox/",
      "tests/e2e/webhook-outbox-dispatch.test.ts"
    ],
    packageScripts: ["test:integration", "test:e2e"],
    migrationMode: "extend",
    migrationRisk: "medium",
    estimatedEffort: "L",
    recommendation: "应补齐统一 receipt contract，不应先拆新 receipt 子系统。"
  },
  {
    capability: "authoritative-task-store-truth",
    label: "Authoritative Task Store / Truth",
    expectedPath: "single authoritative truth store",
    actualPaths: [
      "src/platform/five-plane-state-evidence/truth/",
      "src/platform/five-plane-state-evidence/truth/authoritative-task-store.ts"
    ],
    testPaths: [
      "tests/unit/platform/state-evidence/truth/",
      "tests/integration/platform/state-evidence/truth/"
    ],
    packageScripts: ["test:integration"],
    migrationMode: "keep",
    migrationRisk: "low",
    estimatedEffort: "M",
    recommendation: "不允许复制第二套任务真源。"
  },
  {
    capability: "memory-governance",
    label: "Memory governance",
    expectedPath: "logical Memory Gateway facade over existing memory plane",
    actualPaths: [
      "src/platform/five-plane-state-evidence/memory/",
      "src/platform/five-plane-orchestration/harness/memory-manager.ts"
    ],
    testPaths: [
      "tests/unit/platform/state-evidence/memory/",
      "tests/integration/platform/state-evidence/memory/"
    ],
    packageScripts: ["test:integration"],
    migrationMode: "wrap",
    migrationRisk: "medium",
    estimatedEffort: "L",
    recommendation: "应补 facade / proposal / revoke contract，而非新建平行 memory 包。"
  },
  {
    capability: "release-rollout-gate",
    label: "Release / Rollout gate",
    expectedPath: "release governance contract over existing stable gate and release pipeline",
    actualPaths: [
      "src/platform/shared/stability/stable-release-gate.ts",
      "src/sdk/cli/release-pipeline.ts",
      "src/platform/five-plane-control-plane/config-center/"
    ],
    testPaths: [
      "tests/unit/platform/stability/",
      "tests/integration/platform/execution/stable-release-gate.test.ts",
      "tests/integration/sdk/cli/release-pipeline-cli.test.ts"
    ],
    packageScripts: ["gate:stable"],
    migrationMode: "extend",
    migrationRisk: "medium",
    estimatedEffort: "L",
    recommendation: "应在现有稳定性门禁上补 release contract。"
  },
  {
    capability: "evaluation-harness-grading",
    label: "Evaluation / Harness grading",
    expectedPath: "single harness evaluation stack",
    actualPaths: [
      "src/platform/five-plane-orchestration/harness/evaluation/",
      "src/platform/five-plane-orchestration/harness/eval-harness/"
    ],
    testPaths: [
      "tests/unit/platform/orchestration/harness/evaluation/",
      "tests/integration/platform/orchestration/harness/"
    ],
    packageScripts: ["validate:stable:compiled"],
    migrationMode: "keep",
    migrationRisk: "low",
    estimatedEffort: "M",
    recommendation: "不要复制独立 eval stack。"
  },
  {
    capability: "observability",
    label: "Observability",
    expectedPath: "agent-aware extension over shared observability",
    actualPaths: [
      "src/platform/shared/observability/"
    ],
    testPaths: [
      "tests/unit/platform/shared/observability/",
      "tests/integration/platform/shared/observability/"
    ],
    packageScripts: ["observability:smoke"],
    migrationMode: "extend",
    migrationRisk: "low",
    estimatedEffort: "M",
    recommendation: "应补 agent trace 口径，不应新建第二套日志/指标体系。"
  },
  {
    capability: "sandbox-execution-guard",
    label: "Sandbox / execution guard",
    expectedPath: "shared sandbox contract over existing execution guards",
    actualPaths: [
      "src/platform/five-plane-execution/tool-executor/command-security.ts",
      "src/platform/five-plane-execution/tool-executor/tool-path-scope.ts",
      "src/platform/five-plane-orchestration/harness/sandbox/"
    ],
    testPaths: [
      "tests/unit/platform/execution/tool-executor/sandbox.test.ts",
      "tests/unit/platform/orchestration/harness/sandbox/index.test.ts",
      "tests/integration/platform/five-plane-execution/tool-executor/sandbox-security.integration.test.ts"
    ],
    packageScripts: ["test:integration"],
    migrationMode: "wrap",
    migrationRisk: "medium",
    estimatedEffort: "M",
    recommendation: "可以提炼共享 contract；仅在现有边界不够时再拆目录。"
  },
  {
    capability: "approval-ui-api",
    label: "Approval UI / API",
    expectedPath: "extend current approval UI and API",
    actualPaths: [
      "ui/packages/features/approval/",
      "src/platform/five-plane-interface/api/http-server/approval-routes.ts",
      "src/platform/five-plane-interface/console/hitl/"
    ],
    testPaths: [
      "ui/tests/unit/ui/packages/features/approval/",
      "tests/e2e/approval-flows.test.ts"
    ],
    packageScripts: ["test:e2e"],
    migrationMode: "extend",
    migrationRisk: "low",
    estimatedEffort: "M",
    recommendation: "补齐能力即可，不必重建 admin console。"
  },
  {
    capability: "architecture-boundary-scan-automation",
    label: "Architecture boundary scan automation",
    expectedPath: "scan-current-codebase-gap and architecture-boundary-scan scripts",
    actualPaths: [
      "scripts/",
      ".github/workflows/"
    ],
    testPaths: [
      "tests/invariants/"
    ],
    packageScripts: [
      "scan:current-codebase-gap",
      "lint:architecture-boundary"
    ],
    migrationMode: "new",
    migrationRisk: "high",
    estimatedEffort: "M",
    recommendation: "扫描脚本已落地；下一步应把 detect-only 结果接入 CI workflow，并补 enforce 切换策略。"
  }
];

const directBypassLocations = scanDirectBypassLocations();
const items = capabilitySpecs.map((spec) => buildItem(spec, directBypassLocations));
const summary = summarize(items);
const report = {
  version: "v1.9",
  generatedAt,
  source: "scripts/scan-current-codebase-gap.mjs",
  scope: [
    "src/platform/",
    "src/org-governance/",
    "src/sdk/",
    "ui/",
    "tests/",
    "scripts/",
    ".github/workflows/",
    "package.json"
  ],
  packageScripts: collectExistingScripts([
    "test:integration",
    "test:e2e",
    "gate:stable",
    "validate:stable:compiled",
    "prompt-injection:stable",
    "security:tenant",
    "observability:smoke",
    "docs:markdown-render",
    "lint:architecture-boundary",
    "scan:current-codebase-gap"
  ]),
  workflows: workflows.map((file) => relative(root, file)),
  directBypassSummary: {
    toolExecutorImportsOutsideExecution: directBypassLocations.toolExecutorImportsOutsideExecution.length,
    memoryImportsOutsideStateEvidenceOrHarness: directBypassLocations.memoryImportsOutsideStateEvidenceOrHarness.length,
    stableReleaseGateImportsOutsideStabilityOrSdk: directBypassLocations.stableReleaseGateImportsOutsideStabilityOrSdk.length
  },
  items
};

const jsonArtifactRelativePath = "artifacts/current-codebase-gap-review-v1.9.json";
const markdownArtifactRelativePath = "artifacts/current-codebase-gap-review-v1.9.md";

writeJson(jsonArtifactRelativePath, report);
writeText(markdownArtifactRelativePath, renderMarkdown(report, summary));

console.log(
  `current codebase gap review generated: ${
    join(root, markdownArtifactRelativePath)
  }`
);
console.log(
  `current codebase gap artifact generated: ${
    join(root, jsonArtifactRelativePath)
  }`
);

function buildItem(spec, directBypass) {
  const actualPaths = spec.actualPaths.filter(pathExists);
  const testFiles = spec.testPaths.filter(pathExists);
  const packageScripts = spec.packageScripts.filter((name) => typeof packageJson.scripts?.[name] === "string");
  const implementationStatus = inferImplementationStatus(spec, actualPaths, testFiles, packageScripts);
  return {
    capability: spec.capability,
    label: spec.label,
    expectedPath: spec.expectedPath,
    actualPaths,
    implementationStatus,
    directBypassLocations: selectDirectBypassLocations(spec.capability, directBypass),
    testFiles,
    packageScripts,
    migrationMode: spec.migrationMode,
    migrationRisk: spec.migrationRisk,
    estimatedEffort: spec.estimatedEffort,
    recommendation: spec.recommendation
  };
}

function inferImplementationStatus(spec, actualPaths, testFiles, packageScripts) {
  if (spec.migrationMode === "new") {
    return actualPaths.length === 0 && packageScripts.length === 0 ? "missing" : "partial";
  }
  if (actualPaths.length === spec.actualPaths.length && testFiles.length > 0) {
    return spec.migrationMode === "keep" ? "implemented" : "partial";
  }
  if (actualPaths.length > 0) {
    return "partial";
  }
  return "missing";
}

function summarize(items) {
  const counts = {
    implemented: 0,
    partial: 0,
    missing: 0,
    keep: 0,
    wrap: 0,
    extend: 0,
    new: 0
  };
  for (const item of items) {
    counts[item.implementationStatus] += 1;
    counts[item.migrationMode] += 1;
  }
  return counts;
}

function scanDirectBypassLocations() {
  const sourceFiles = listFiles("src", (file) => file.endsWith(".ts"));
  const toolExecutorImportsOutsideExecution = [];
  const memoryImportsOutsideStateEvidenceOrHarness = [];
  const stableReleaseGateImportsOutsideStabilityOrSdk = [];
  for (const file of sourceFiles) {
    const rel = relative(root, file);
    const content = readFileSync(file, "utf8");
    if (
      content.includes("five-plane-execution/tool-executor") &&
      !rel.startsWith("src/platform/five-plane-execution/") &&
      !rel.startsWith("src/platform/five-plane-orchestration/harness/")
    ) {
      toolExecutorImportsOutsideExecution.push(rel);
    }
    if (
      content.includes("five-plane-state-evidence/memory") &&
      !rel.startsWith("src/platform/five-plane-state-evidence/") &&
      !rel.startsWith("src/platform/five-plane-orchestration/harness/")
    ) {
      memoryImportsOutsideStateEvidenceOrHarness.push(rel);
    }
    if (
      content.includes("stable-release-gate") &&
      !rel.startsWith("src/platform/shared/stability/") &&
      !rel.startsWith("src/platform/stability/") &&
      !rel.startsWith("src/sdk/")
    ) {
      stableReleaseGateImportsOutsideStabilityOrSdk.push(rel);
    }
  }
  return {
    toolExecutorImportsOutsideExecution,
    memoryImportsOutsideStateEvidenceOrHarness,
    stableReleaseGateImportsOutsideStabilityOrSdk
  };
}

function selectDirectBypassLocations(capability, directBypass) {
  switch (capability) {
    case "tool-execution-registry-boundary":
      return directBypass.toolExecutorImportsOutsideExecution;
    case "memory-governance":
      return directBypass.memoryImportsOutsideStateEvidenceOrHarness;
    case "release-rollout-gate":
      return directBypass.stableReleaseGateImportsOutsideStabilityOrSdk;
    default:
      return [];
  }
}

function collectExistingScripts(names) {
  return names
    .filter((name) => typeof packageJson.scripts?.[name] === "string")
    .map((name) => ({
      name,
      command: packageJson.scripts[name]
    }));
}

function renderMarkdown(reportData, summary) {
  const itemRows = reportData.items.map((item) => [
    item.label,
    code(item.actualPaths.join("、")),
    item.implementationStatus,
    item.migrationMode,
    item.migrationRisk,
    item.estimatedEffort,
    item.recommendation
  ]);
  const scriptRows = reportData.packageScripts.map((script) => [code(script.name), code(script.command)]);
  const workflowRows = reportData.workflows.map((workflow) => workflow);
  const bypassLines = [
    `1. tool executor 越层导入候选：${reportData.directBypassSummary.toolExecutorImportsOutsideExecution}`,
    `2. memory 越层导入候选：${reportData.directBypassSummary.memoryImportsOutsideStateEvidenceOrHarness}`,
    `3. stable release gate 越层导入候选：${reportData.directBypassSummary.stableReleaseGateImportsOutsideStabilityOrSdk}`
  ];
  return `# Current Codebase Gap Review v1.9

| 字段 | 内容 |
|---|---|
| 文档版本 | v1.9 |
| 扫描日期 | ${generatedAt.slice(0, 10)} |
| 扫描方式 | 自动扫描（\`scripts/scan-current-codebase-gap.mjs\`） |
| 适用文档 | \`docs_zh/reference/automatic_agent_system_harness_improvement_plan_v1_9_architecture_release.md\` |
| 结论 | 现有系统与 v1.9 方向无顶层架构冲突；应以复用、包装、扩展现有实现为主，禁止按目标名词平行新建第二套子系统 |
| 当前阻断项 | \`lint:architecture-boundary\` 已落地但尚未接入 CI enforce；真实 Owner/Reviewer 未绑定 |

---

## 1. 扫描范围

${reportData.scope.map((entry, index) => `${index + 1}. ${code(entry)}`).join("\n")}

---

## 2. 现有命令与工作流证据

### 2.1 已存在的聚合命令

${renderTable(["命令", "当前实现"], scriptRows)}

### 2.2 已存在的 CI workflow

${workflowRows.map((workflow, index) => `${index + 1}. ${code(workflow)}`).join("\n")}

结论：仓库已经存在可复用的测试、验证、发布和 UI 质量工作流；v1.9 文档里的多数 P0 验收命令应先绑定到这些现有 aggregate 命令，而不是先造新目录或新命令名。

---

## 3. 能力映射结论

${renderTable(
  ["能力", "当前实现证据", "当前状态", "推荐动作", "风险", "工作量", "结论"],
  itemRows
)}

---

## 4. 汇总

1. implementationStatus: implemented=${summary.implemented}, partial=${summary.partial}, missing=${summary.missing}
2. migrationMode: keep=${summary.keep}, wrap=${summary.wrap}, extend=${summary.extend}, new=${summary.new}
3. 真正需要补强的能力主要是自动化扫描接入 CI 和边界 lint enforce，而不是新的业务子系统。

---

## 5. 越层导入候选

${bypassLines.join("\n")}

说明：这是启发式扫描结果，用于后续 \`lint:architecture-boundary\` 脚本落地前的初筛，不等同最终违规判定。

---

## 6. 当前结论

1. v1.9 文档与当前系统方向一致。
2. 当前系统已经具备大部分实施基础。
3. 风险主要来自重复建设，而不是方向冲突。
4. 下一步应优先实现 \`lint:architecture-boundary\`，并将本扫描纳入 CI 可复现产物。
`;
}

function renderTable(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const divider = `|${headers.map(() => "---").join("|")}|`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return `${head}\n${divider}\n${body}`;
}

function code(value) {
  return value.length > 0 ? `\`${value}\`` : "`-`";
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

function pathExists(relativePath) {
  return existsSync(join(root, relativePath));
}

function writeJson(relativePath, value) {
  writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(relativePath, value) {
  const outputPath = join(root, relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, value, "utf8");
}

function listFiles(relativePath, predicate = () => true) {
  const start = join(root, relativePath);
  if (!existsSync(start)) {
    return [];
  }
  const results = [];
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) {
      continue;
    }
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) {
        if (entry === "node_modules" || entry === "dist" || entry === ".git") {
          continue;
        }
        stack.push(join(current, entry));
      }
      continue;
    }
    if (stat.isFile() && predicate(current)) {
      results.push(current);
    }
  }
  return results.sort();
}
