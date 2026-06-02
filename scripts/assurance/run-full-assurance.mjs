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
  // Observe-mode scanners surface findings into the issue ledger / scorecard.
  { id: "audit_tenant_isolation",  command: "npm", args: ["run", "audit:tenant-isolation"],  required: false, rationale: "P0 跨租户隔离扫描" },
  { id: "audit_secret_sinks",      command: "npm", args: ["run", "audit:secret-sinks"],      required: false, rationale: "P0 secret 泄露到 log/throw/event sink" },
  { id: "audit_fire_and_forget",   command: "npm", args: ["run", "audit:fire-and-forget"],   required: false, rationale: "P1 fire-and-forget Promise" },
  { id: "audit_determinism",       command: "npm", args: ["run", "audit:determinism"],       required: false, rationale: "P0 Date.now/Math.random in business code" },
  { id: "audit_release_claims",    command: "npm", args: ["run", "audit:release-claims"],    required: false, rationale: "P0 final/production-ready 声明的 evidenceRef 缺失检测" },
  { id: "audit_architecture_boundary", command: "npm", args: ["run", "audit:architecture-boundary"], required: false, rationale: "P0 五平面 import 边界" },
  { id: "audit_path_safety",       command: "npm", args: ["run", "audit:path-safety"],       required: false, rationale: "P0 脚本 rm/mv/cp/write 路径守卫" },
  { id: "audit_eval_oracle",       command: "npm", args: ["run", "audit:eval-oracle"],       required: false, rationale: "P0 eval expectedOutput 当 actualOutput" },
  { id: "audit_plugin_security",   command: "npm", args: ["run", "audit:plugin-security"],   required: false, rationale: "P0 plugin signature/SBOM fail-open" },
  { id: "audit_ui_token_storage",  command: "npm", args: ["run", "audit:ui-token-storage"],  required: false, rationale: "P0 UI token 存储" },
  { id: "audit_contracts_sync",    command: "npm", args: ["run", "audit:contracts-sync"],    required: false, rationale: "P0 contract N-way 对账" },
  { id: "audit_idempotency",       command: "npm", args: ["run", "audit:idempotency"],       required: false, rationale: "P0 §10.1 write call missing idempotency key" },
  { id: "audit_queue",             command: "npm", args: ["run", "audit:queue"],             required: false, rationale: "P0 §10.2 queue atomic / visibility / backoff" },
  { id: "audit_lease_fencing",     command: "npm", args: ["run", "audit:lease-fencing"],     required: false, rationale: "P0 §10.3 lease / fencing token" },
  { id: "audit_side_effect_receipt", command: "npm", args: ["run", "audit:side-effect-receipt"], required: false, rationale: "P0 §10.4 side-effect / receipt producer" },
  { id: "audit_recovery_replay",   command: "npm", args: ["run", "audit:recovery-replay"],   required: false, rationale: "P0 §10.5 recovery / replay tenant + transaction" },
  { id: "audit_audit_chain",       command: "npm", args: ["run", "audit:audit-chain"],       required: false, rationale: "P0 §11.1 audit chain integrity" },
  { id: "audit_receipt_verification", command: "npm", args: ["run", "audit:receipt-verification"], required: false, rationale: "P0 §11.2 receipt factory / signature / schemaVersion" },
  { id: "audit_event_outbox",      command: "npm", args: ["run", "audit:event-outbox"],      required: false, rationale: "P0 §11.3 outbox atomicity / partition / cursor" },
  // === 2026-06-02: §9.3 + §20.6 + §10/§11 coverage gates ===
  { id: "audit_auth_role_mapping", command: "npm", args: ["run", "audit:auth-role-mapping"],  required: false, rationale: "P0 §9.3 service principal / admin / approval bypass" },
  { id: "audit_docs_sot",          command: "npm", args: ["run", "audit:docs-sot"],          required: false, rationale: "P1 §20.6 source-of-truth drift (broken src / schema references)" },
  { id: "audit_execution_invariants", command: "npm", args: ["run", "audit:execution-invariants"], required: false, rationale: "P0 §10/§11 invariant test coverage" },
  { id: "audit_test_disabled",     command: "npm", args: ["run", "audit:test-disabled"],     required: false, rationale: "P0 §44.15.1 disabled/skip/only/todo without @quarantine metadata" },
  {
    id: "issue_ledger",
    command: "npm",
    args: ["run", "assurance:issue-ledger"],
    required: true,
    rationale: "聚合 review / historical promise / audit findings，生成中英文 issue ledger 镜像。",
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
    "assurance:full 会生成 inventory、review ledger、historical promises、issue ledger、coverage scorecard 等核心 assurance 产物。",
    "observe-mode 审计结果进入 ledger 与 scorecard；是否阻断 release 由 rc:check 汇总判定。",
  ],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (failedRequiredSteps.length > 0) {
  process.exitCode = 1;
}
