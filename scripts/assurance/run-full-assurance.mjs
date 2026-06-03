import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..", "..");
const outputPath = join(repoRoot, "artifacts", "assurance", "assurance-full-report.json");

const steps = [
  {
    id: "inventory",
    command: "npm",
    args: ["run", "assurance:inventory"],
    required: true,
    rationale: "生成全仓 inventory、metrics 与 baseline snapshot。",
  },
  {
    id: "review_import",
    command: "npm",
    args: ["run", "assurance:review-import:check"],
    required: true,
    rationale: "把 docs_zh/reviews 恢复成 machine-readable review ledger，并阻断 parse warning / blocking conflict。",
  },
  {
    id: "public_entrypoints",
    command: "npm",
    args: ["run", "audit:public-entrypoints"],
    required: true,
    rationale: "保证公开入口面没有绕过 contract 的深层导入漂移。",
  },
  {
    id: "historical_promises",
    command: "npm",
    args: ["run", "assurance:historical-promises"],
    required: true,
    rationale: "把 reference / release / review 等历史承诺恢复成 promise ledger，避免旧承诺只存在文档叙述里。",
  },
  {
    id: "assumptions",
    command: "npm",
    args: ["run", "assurance:assumptions"],
    required: true,
    rationale: "把 unknown assumption 恢复成 assumptions ledger，避免未验证前提只存在 prose 里。",
  },
  {
    id: "leadership_claims",
    command: "npm",
    args: ["run", "audit:leadership-claims"],
    required: true,
    rationale: "保证 release / reference / review 文档中的行业领先与 production-ready 语句都受 claim governance 约束。",
  },
  {
    id: "docs_sync",
    command: "npm",
    args: ["run", "audit:docs-sync"],
    required: true,
    rationale: "保证中英文 contract/reference/review 文档树不继续漂移，避免历史承诺在双语文档中裂开。",
  },
  {
    id: "static_audit",
    command: "npm",
    args: ["run", "assurance:static-audit"],
    required: true,
    rationale: "执行 Layer 3 静态审计并统一产出 static-audit-report.{json,md} 与 static-audit-findings.jsonl。",
  },
  {
    id: "issue_ledger",
    command: "npm",
    args: ["run", "assurance:issue-ledger"],
    required: true,
    rationale: "聚合 review / historical promise / audit findings，生成中英文 issue ledger 镜像。",
  },
  {
    id: "test_to_issue",
    command: "npm",
    args: ["run", "assurance:test-to-issue"],
    required: true,
    rationale: "P1 §44.18 test↔issue 双向映射生成，供 regression map / fix verification / coverage scorecard 复用。",
  },
  {
    id: "historical_regression_map",
    command: "npm",
    args: ["run", "assurance:historical-regression-map"],
    required: true,
    rationale: "方法论 §22 Historical Issue Regression Map，把历史问题反向映射到 audit/test/seed/gate。",
  },
  {
    id: "fix_verification",
    command: "npm",
    args: ["run", "assurance:fix-verification"],
    required: false,
    rationale: "P1 §29 Fix Verification Contract 报告。",
  },
  {
    id: "audit_dataset",
    command: "npm",
    args: ["run", "audit:dataset"],
    required: false,
    rationale: "P0 §12.2 dataset-card (samples / frozenHash / additionalProperties:false)。",
  },
  {
    id: "audit_redteam",
    command: "npm",
    args: ["run", "audit:redteam"],
    required: false,
    rationale: "P0 §12.3 redteam suite (caseId / evidenceRefs / releaseBlocking)。",
  },
  {
    id: "audit_golden",
    command: "npm",
    args: ["run", "audit:golden"],
    required: false,
    rationale: "P0 §12.4 golden fixture (frozenClock / seedInjected / allowedDiffList)。",
  },
  {
    id: "assurance_verify_test_coverage",
    command: "npm",
    args: ["run", "assurance:verify-test-coverage"],
    required: true,
    rationale: "P0 issue 必须绑定至少 1 个 test。",
  },
  {
    id: "completeness_matrix",
    command: "npm",
    args: ["run", "assurance:completeness-matrix"],
    required: true,
    rationale: "方法论 §21 Completeness Coverage Matrix，量化问题域 × 方法 × gate 覆盖情况。",
  },
  {
    id: "coverage_scorecard",
    command: "npm",
    args: ["run", "assurance:coverage-scorecard"],
    required: true,
    rationale: "基于当前 assurance 产物生成 coverage scorecard 与 release blocker 摘要。",
  },
];

const notYetIntegratedAudits = [];

function runStep(step) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(step.command, step.args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 32 * 1024 * 1024,
  });
  const endedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const exitCode = result.status ?? 1;

  if (stdout.length > 0) {
    process.stdout.write(stdout);
  }
  if (stderr.length > 0) {
    process.stderr.write(stderr);
  }

  return {
    id: step.id,
    required: step.required,
    rationale: step.rationale,
    command: [step.command, ...step.args].join(" "),
    startedAt,
    endedAt,
    exitCode,
    ok: exitCode === 0,
  };
}

const results = steps.map(runStep);
const failedRequiredSteps = results.filter((result) => result.required && !result.ok).map((result) => result.id);
const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  mode: "full",
  status: failedRequiredSteps.length === 0 ? "pass" : "fail",
  executedSteps: results,
  notYetIntegratedAudits,
  notes: [
    "assurance:full 会生成 inventory、review ledger、historical promises、assumptions、static audit、issue ledger、historical regression map、completeness matrix、coverage scorecard 等核心 assurance 产物。",
    "Layer 3 static audit 会统一产出 static-audit-report.{json,md} 与 static-audit-findings.jsonl；issue-ledger 默认复用这些产物而不重复重跑扫描器。",
    "review-import 现在同时产出 review-evidence-readiness-report.json，用于声明 blind spot / checklist / dual-person readiness。",
    "observe-mode 审计结果进入 ledger 与 scorecard；是否阻断 release 由 rc:check 汇总判定。",
  ],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (failedRequiredSteps.length > 0) {
  process.exitCode = 1;
}
