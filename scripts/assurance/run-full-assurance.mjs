import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..", "..");
const outputPath = join(repoRoot, "artifacts", "assurance", "assurance-full-report.json");

const steps = [
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
    args: ["run", "audit:historical-promises"],
    required: true,
    rationale: "把 reference / release / review 等历史承诺恢复成 promise ledger，避免旧承诺只存在文档叙述里。",
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
];

const notYetIntegratedAudits = [
  "audit:contracts-sync",
  "audit:secret-sinks",
  "audit:tenant-isolation",
  "audit:plugin-security",
  "audit:eval-oracle",
  "audit:path-safety",
  "audit:execution-invariants",
];

function runStep(step) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(step.command, step.args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
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
  status: failedRequiredSteps.length === 0 ? "pass" : "fail",
  executedSteps: results,
  notYetIntegratedAudits,
  notes: [
    "当前 assurance:full 只聚合已经具备稳定脚本与清晰失败语义的基线审计。",
    "historical promise / release claim / tenant isolation 等更高层审计仍需逐项实现或收口后再并入 required set。",
  ],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (failedRequiredSteps.length > 0) {
  process.exitCode = 1;
}
