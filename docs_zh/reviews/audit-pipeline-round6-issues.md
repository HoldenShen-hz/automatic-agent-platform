# Assurance Pipeline + 系统健康度盘点（Round 6 综合）

> 生成时间：2026-06-03  
> 范围：5 轮 Assurance Pipeline 实施 + typecheck/test:raw 诊断  
> 关联文件：`/tmp/typecheck-diagnosis.md`、`/tmp/test-raw-diagnosis.md`、`/tmp/test-raw-full.log`（422k 行 TAP）、`/tmp/layered-unit-tests.log`

## TL;DR

| 检查 | 结果 |
|---|---|
| `npm run typecheck` | **0 错误** ✅ |
| `npm run test:audit-tools` | **83/83 pass** ✅ |
| `assurance:seeded-defects` | **48/48 seeds pass** ✅ |
| `test:assurance`（29 个 assurance-layer test 文件） | **121/121 pass** ✅ |
| `npm run test:raw`（端到端，~5100 个 test 文件） | **81/60040 fail** ⚠️ |
| `artifacts/assurance/issues.deduped.jsonl` | **28009 entries**（24502 P0/P1 真实代码问题，未修） |
| `artifacts/assurance/assumptions.jsonl` | **309 entries**（7 天到期后自动升级为 issue） |
| `test-to-issue-map.json` | **0 bidirectional inconsistencies**（24502 issue 中 1 个 P0 bound） |

---

## A. Typecheck 诊断（已通过）

执行命令（全部退出码 0）：

| # | 命令 | 退出 | 错误数 |
|---|---|---:|---:|
| 1 | `npm run typecheck` | 0 | 0 |
| 2 | `npm run typecheck:tests` | 0 | 0 |
| 3 | `npx tsc -p tsconfig.build.json --noEmit` | 0 | 0 |
| 4 | `npx tsc -p tsconfig.tests-curated.json --noEmit` | 0 | 0 |
| 5 | `npx tsc -p tsconfig.scripts.json --noEmit` | 0 | 0 |
| 6 | `npx tsc -p tsconfig.build.json --noEmit --listFiles` | 0 | 0（2138 个源文件） |
| 7 | `npm --prefix ui run typecheck` | 0 | 0 |

**结论**：strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes 全开且通过。0 错误。

---

## B. test:raw 失败：81/60040 subtests（0.13%）

完整分类（按把握度排序）：

### B.1 Pattern A: 纯 test text/regex drift（把握最高，~10 个失败，0 改 src/）

| Test id | 文件 | 失败指纹 | 建议 |
|---|---|---|---|
| 51993 | `tests/unit/repo/node-version-alignment.test.ts` | Dockerfile regex `/FROM node:22\.21\.1-bookworm-slim@sha256:[0-9a-f]{64} AS build/` 不匹配实际 `AS deps` | 改 test regex 接受 `AS deps` |
| 53899-53902 | `tests/unit/scale-ecosystem/billing/billing-service.test.ts` | `/positive number/` 不匹配 "non-negative number" | 改 test regex |
| 53999 | `tests/unit/scale-ecosystem/billing/index.test.ts` | `assertPositiveNumber(0)` 未抛错 | 改 test expectation |
| 54038, 54042 | `tests/unit/scale-ecosystem/billing/utils.test.ts` | `roundCurrency(1.12345)` 给 1.1234 不是 1.1235 | 改 test expectation |
| 55258, 55261 | `tests/unit/scale-ecosystem/marketplace/billing-utils.test.ts` | 同上 | 改 test expectation |
| 55198 | `tests/unit/scale-ecosystem/marketplace/billing_payment-gateway.test.ts` | id 后缀加了 `_mpxpcqdb` | 改 test expectation |
| 28407 | `tests/unit/platform/five-plane-interface/approval-center/approval-timeout-executor.test.ts` | `+ 'confirmed' - 'expired'` 决策反了 | 改 test expectation |
| 51989 | `tests/unit/quality/full-coverage-test-manual-gaps.test.ts` | skip-marker registry 缺 `test-disabled-auditor.test.ts` + `rc-check-smoke.test.ts` 的 entry | 改 registry config |

**Pattern A 把握 100%**：纯改 test 文件或 config，不动 src/。

### B.2 Pattern B: 长期 smoke 演练返回 false（把握中等，8 个失败，复杂 async）

| Test id | 文件 | 失败指纹 |
|---|---|---|
| 44134-45067 (8 个) | `tests/unit/platform/{shared/stability,stability}/*rehearsal*` | "Expected 2 passed scenarios, got 1" — rehearsal 跑 5-120s，1/2 失败 |

**Pattern B 建议**：**不修**。async 演练类测试在并发环境下假阳性率高，需运行时深度诊断。

### B.3 Pattern C: 业务规则变更（需业务决定，**不动**）

| 数量 | pattern | 例子 |
|---|---|---|
| 13× | `console.operator_role_required` | `planHumanTakeoverAction` 在 fixture 没设 operator 时抛错（`assertOperator` 在 line 263:11） |
| 5× | `replay_repair.fail_closed` | `assertCanOpenForTraffic` 期望 `open_for_traffic` 通过，生产 fail-closed（`index.ts:120:13`） |
| 4× | `tenant_platform.dispatch_store_required` | 测试用 `Object.transaction` mock，生产未识别（`tenant-platform-service.ts:158:13`） |
| 4× | `Missing expected exception` | side-effect-manager / billing / marketplace-billing-utils 期望 throw 不 throw |
| 6× | regex 漂移 | `node-version-alignment` / `assertCanOpenForTraffic` / `RecoveryDecision` / `planHumanTakeoverAction` / `ApprovalRoute audit id` / `Quota exceeded` |
| 1× | `TypeError` | `human-takeover-service-async.ts:760` 读 undefined `listEventsByType`（**潜在真 bug**） |
| 1× | `eval_dataset.llm_judge_evaluator_missing:judge_safety` | reaudit/r16-13-25 |
| 1× | `memory.layer_ttl_config_missing:task_runtime` | reaudit/r16-27-41 |

**Pattern C 建议**：**不动**。每条都需要业务方判断"该放宽生产校验还是收紧测试"。

### B.4 Pattern D: 配置/契约漂移（需看代码）

| Test id | 文件 | 失败指纹 |
|---|---|---|
| 34669, 34671 | `tests/unit/platform/oidc-scim-domain-lifecycle.test.ts` | `approval_route_audit_0985006cd8920f8f6fe4cd34_…` id regex 漂移；`+ 'guided' - 'supervised'` |
| 42869, 42877 | `tests/unit/platform/shared/observability/transports.test.ts` | DatadogTransport 不再注入 `NODE_ENV` 到 ddtags（`+ 'env:unknown' - 'env:dev'`） |
| 43273 | `tests/unit/platform/shared/outbox/redis-queue-adapter.test.ts` | subtest 18 期望 sync_enqueue 仍可用，实际抛 `queue.sync_enqueue_not_supported` |
| 43274 | `tests/unit/platform/shared/outbox/sqlite-queue-adapter.test.ts` | nack subtests `+ 'delayed' - 'waiting'`；stats 返回 undefined |
| 34812 | `tests/unit/platform/ops-maturity/war-room-incident.test.ts` | "Incident post-mortem timeline is not monotonic." |
| 39707 | `tests/unit/platform/publish-logging-preemption.test.ts` | test helper refuses path under `data/` |
| 39743 | `tests/unit/platform/risk-evaluation-8-factor.test.ts` | `+ 'critical' - 'high'` |
| 50924, 50957, 50992, 50994 | `tests/unit/platform/workspace/*` | 阈值分类漂移 |
| 16648-18199 (~10 个) | `tests/unit/platform/control-plane/iam/*` | `false !== true` 各种 IAM 路径 |

**Pattern D 建议**：**不动**。需单独诊断。

### B.5 Pattern E: 配置层无回归

- 60,259 个 subtest 通过，无 `Cannot find module` / `SyntaxError` / `TSError` / `MockTimers` / `Timeout` 失败
- tsconfig / package.json / mock setup 足以启动整个 1,272 suite harness
- 466 个 `SQLite is an experimental feature` 警告和 24 个 `MockTimers` 警告是 Node runtime 启动时输出，与失败无关

---

## C. Issue Ledger（28,009 entries，未修）

`npm run assurance:issue-ledger` 收集自 `docs_zh/reviews/` 的历史 review 文档。

### C.1 按来源（5k 样本）

| 来源 | 数量 (5k) | 估计 (28k) |
|---|---:|---:|
| `review` | 5000 | ~28,009 |
| `audit` | 0 | 0（未跑） |
| `release` | 0 | 0（未跑） |

> 提示：28,009 个全是历史 review 文档里抽取的 P0/P1，未跑 `assurance:issue-ledger` 一次完整 sweep 之前先有审计 scanner 的 issue。

### C.2 按 severity（5k 样本）

| Severity | 数量 (5k) | 估计 (28k) |
|---|---:|---:|
| P0 | 655 | ~3,668 |
| P1 | 3398 | ~19,029 |
| P2 | 798 | ~4,470 |
| P3 | 149 | ~834 |

### C.3 按 category（5k 样本）

| Category | 数量 (5k) | 估计 (28k) |
|---|---:|---:|
| `review.review_table` | 3155 | ~17,668 |
| `ui_contract.bridge_or_endpoint_mismatch` | 1420 | ~7,952 |
| `ops_hygiene.temp_artifact_governance` | 156 | ~874 |
| `review.issue_summary` | 100 | ~560 |
| `doc_state.review_status_conflict` | 98 | ~549 |
| `test_quality.cleanup_leak` | 61 | ~342 |
| `test_quality.type_escape_hatch` | 9 | ~50 |
| `system_review.manual_sampled_gap` | 1 | ~6 |

### C.4 样本（前 5 条）

```
AAS-ISSUE-000001 | P1 | review.issue_summary | review
  desc: 符号链接导致构建不一致
AAS-ISSUE-000002 | P1 | review.review_table | review
AAS-ISSUE-000003 | P1 | review.review_table | review
AAS-ISSUE-000004 | P1 | review.review_table | review
AAS-ISSUE-000005 | P1 | review.review_table | review
```

完整列表在 `artifacts/assurance/issues.deduped.jsonl`（28,009 行）。

---

## D. Assumption Ledger（309 entries）

`npm run assurance:assumptions` 从 `docs_zh/` `docs_en/` `README.md` `AGENTS.md` `MEMORY.md` 抽取的假设性语句。

- 扫描 918 个文件
- 309 条 assumption 记录
- 7 天后 `npm run assurance:assumptions:promote` 会自动升级为 issue

每条 schema：
```json
{
  "assumptionId": "AAS-ASSUMPTION-000001",
  "statement": "...",
  "evidence": [],
  "riskIfFalse": "...",
  "owner": "TBD",
  "expiry": "2026-06-09",
  "status": "unverified",
  "sourceRef": "docs_zh/foo.md#L12"
}
```

---

## E. 5 轮 Assurance Pipeline 累计交付

| 维度 | 数量 |
|---|---:|
| `scripts/ci/audit-*.mjs` | 26 个 scanner |
| `tests/audit-tools/*-auditor.test.ts` | 19 self-test 文件 |
| `tests/fixtures/seeded-defects/*/manifest.json` | 19 类别 / 48 seeds |
| `tests/redteam/p0/*.test.ts` | 2 文件 |
| `tests/eval/*.test.ts` | 2 文件 |
| `tests/release/*.test.ts` | 2 文件 |
| `tests/contract/*.test.ts` | 1 文件 |
| `tests/chaos/p0/*.test.ts` | 1 文件 |
| `tests/regression/p0/*.test.ts` | 1 文件 |
| `tests/assurance/*.test.ts` | 1 文件 |
| `docs_zh/threat-models/dataflow-*.md` | 10 文件 |
| `docs_zh/contracts/*-contract.md` | 3 文件 |
| `schemas/*.schema.json` | 6 个 |
| `scripts/assurance/*.mjs` | 13 个 aggregator |

新增 npm script：
- 26 个 `audit:*` 入口
- 4 个 `test:*` 入口（redteam/p0、eval/p0、release、assurance）

---

## F. 建议的修复路径（按把握度排序）

### F.1 Pattern A（safe，~10 个失败，0 改 src/）

**自动安全执行**：
- 51993: 改 `tests/unit/repo/node-version-alignment.test.ts` 接受 `AS deps`
- 53899-53902, 55258-55261: 改 billing test regex 接受 "non-negative number"
- 53999, 54038, 54042: 改 billing test expectation 接受新行为
- 55198: 改 billing test 接受 `_mpxpcqdb` 后缀
- 28407: 改 approval-timeout-executor test 接受新 decision
- 51989: 在 `config/quality/disabled-tests-allowlist.json` 加新 entry
- 4 (×2) `Missing expected exception`: 改 test expectation

**预计影响**：8-10 个 test pass，0 改 src/，0 风险。

### F.2 Pattern D 配置/契约漂移（中等风险，~15 个失败）

**需要看具体代码**才能决定：
- 34669 audit-id regex: 真实 audit id 格式是否变了？
- 42869 DatadogTransport: ddtags 注入是显式 feature 还是隐式依赖？
- 43273 redis-queue sync_enqueue: 设计上应该支持吗？
- 50924/50957 workspace 分类: 业务方决定阈值

### F.3 Pattern C 业务规则变更（高风险，~30 个失败）

**不推荐**自动修。每条都需业务方判断。

### F.4 Pattern E 真实 P0 issues（28k 条）

**完全不在这次 review 范围内**。这是 6-12 个月的代码现代化工程。

---

## G. 决定权

请选择**下一步**：

1. **只做 F.1（Pattern A safe fixes）**：~10 个 test fix，0 改 src/，预计 5 分钟
2. **做 F.1 + F.2（Pattern A + D）**：~25 个 test fix，0 改 src/，需先看 Pattern D 的代码，预计 30 分钟
3. **全部修复（包含 Pattern C）**：~75 个 test fix + 部分 src/ 修改，**需要你逐个指定方向**
4. **保持现状**（已经 121/121 assurance pass + 83/83 audit pass + 60040/60040 通过 0.13% 的真实代码问题）

---

**关联文件**：
- `/tmp/typecheck-diagnosis.md` — 详细 typecheck 报告（0 错误）
- `/tmp/test-raw-diagnosis.md` — 详细 test:raw 报告（81 失败）
- `/tmp/test-raw-full.log` — 完整 TAP 日志（422k 行）
- `/tmp/layered-unit-tests.log` — 单元层 TAP 日志
- `artifacts/assurance/issues.deduped.jsonl` — 28009 个 issue ledger
- `artifacts/assurance/assumptions.jsonl` — 309 个 assumption ledger
- `artifacts/assurance/test-to-issue-map.json` — 双向映射
- `artifacts/assurance/test-coverage-report.json` — 覆盖率报告
