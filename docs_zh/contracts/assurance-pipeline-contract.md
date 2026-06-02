# Assurance Pipeline 契约

> 版本：v1.0  
> 状态：Required by `assurance:full` / `assurance:delta` / `rc:check`  
> 配套 schema：`schemas/assurance-report.schema.json` / `schemas/seeded-defect.schema.json`  
> 关联文档：方法论 §20, §21, §37, §38, §44

## 1. 范围

本契约定义 Automatic Agent Platform 的 **Assurance Pipeline**：

```text
历史问题回收
  → 全仓 Inventory
    → 静态审计
      → 动态不变量测试
        → Contract / Docs / Runtime 对账
          → Eval / Redteam 防假通过
            → Issue Ledger 归并
              → Release Gate 阻断
                → Evidence Bundle 签名归档
```

它覆盖三种执行场景：

| 场景 | 入口脚本 | 触发频率 |
|---|---|---|
| PR Delta | `scripts/assurance/run-delta-assurance.mjs` | 每个 PR |
| Nightly Full | `scripts/assurance/run-full-assurance.mjs` | 每晚 |
| Release rc:check | `scripts/assurance/rc-check.mjs` | release 前 |

## 2. 八层流水线

| Layer | 职责 | npm 脚本 | 关键产物 |
|---|---|---|---|
| 1 Inventory | 全仓文件/合同/事件/指标/测试/文档/config/workflow 索引 | `assurance:inventory` | `artifacts/assurance/source-inventory.json`, `routes.json`, `contracts.json`, `events.json`, `metrics.json`, `tests.json` |
| 2 Historical Promises | 抽取 must/done/final/production-ready 等承诺 | `assurance:historical-promises`, `audit:historical-promises` | `artifacts/assurance/historical-promises.jsonl` |
| 3 Static Audit | contract/secret/tenant/path/import/determinism 扫描 | `audit:contracts-sync`, `audit:secret-sinks`, `audit:tenant-isolation`, `audit:plugin-security`, `audit:path-safety`, `audit:architecture-boundary`, `audit:fire-and-forget`, `audit:determinism`, `audit:release-claims` | `artifacts/assurance/static-audit-report.json` |
| 4 Dynamic Invariant | invariant/chaos/multi-tenant/replay 测试 | `test:invariants`, `test:chaos:p0`, `test:regression:p0` | `artifacts/assurance/invariant-test-report.json` |
| 5 Eval/Redteam/Golden Anti-fake | expected-as-actual/judge 读自评分检测 | `audit:eval-oracle`, `test:redteam:p0`, `test:golden:strict` | `artifacts/assurance/eval-oracle-report.json` |
| 6 Issue Ledger | 归一化 + 去重 + epic 化 | `assurance:issue-ledger` | `artifacts/assurance/issues.{raw,normalized,deduped}.jsonl` |
| 7 Coverage Scorecard | 10 维度评分，判定 release blocked | `assurance:coverage-scorecard` | `artifacts/assurance/audit-coverage-scorecard.{json,md}` |
| 8 Evidence Bundle | 签名归档、verifier 验签 | `evidence:bundle:create`, `evidence:bundle:verify` | `artifacts/release/evidence-bundle.json`, `.sig` |

## 3. PR / Nightly / Release 三个调度场景的差异

### 3.1 PR Delta

```text
changed code        -> audit:fire-and-forget + audit:determinism (changed paths)
changed tests       -> test:unit + test:invariants (impacted subset)
changed docs        -> audit:docs-sync + audit:leadership-claims
changed config      -> audit:ci-supply-chain
changed routes      -> audit:tenant-isolation (changed paths)
changed schemas     -> audit:contracts-sync (changed paths)
changed workflows   -> audit:ci-supply-chain + audit:leadership-claims
```

PR 必须阻断：

```text
新增 P0 issue 未进入 issue-ledger
新增 release claim 无 evidenceRef
新增 route 无 tenantId
新增 fire-and-forget Promise
新增 process.env in library code
新增 in-memory truth store without experimental flag
新增 secret sink
```

### 3.2 Nightly Full

跑全量：

```text
npm run assurance:full
```

输出到 `artifacts/assurance/nightly/YYYY-MM-DD/`。

### 3.3 Release rc:check

```text
npm run rc:check
```

rc:check 内部按顺序：

1. `assurance:full`
2. `test:p0` = `test:invariants` + `test:regression:p0`
3. `test:chaos:p0`
4. `test:redteam:p0`
5. `test:golden:strict`
6. `evidence:bundle:create`
7. `evidence:bundle:verify`

## 4. Release Blocker 规则

任一成立 → 阻断 release：

```text
open P0 issues > 0
contract drift P0 > 0
secret sink P0 > 0
tenant isolation P0 > 0
eval oracle fake pass > 0
release claim unverified > 0
plugin verification fail-open > 0
side-effect receipt missing > 0
unsigned evidence bundle
P0 alert without runbook
P0 audit gate lacks seeded defect test
```

## 5. Evidence Bundle

`artifacts/release/evidence-bundle.json` 至少包含：

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "...",
  "commitSha": "...",
  "branch": "main",
  "contractSchemaVersion": "...",
  "eventRegistryHash": "...",
  "configVersion": "...",
  "validationRunId": "...",
  "includedReports": [
    "artifacts/release/rc-check-report.json",
    "artifacts/release/contract-drift-report.json",
    "artifacts/release/security-audit-report.json",
    "artifacts/release/eval-redteam-report.json",
    "artifacts/release/release-claim-report.json",
    "artifacts/assurance/audit-coverage-scorecard.json"
  ]
}
```

`artifacts/release/evidence-bundle.sig` 是 bundle 的 HMAC-SHA256 签名（密钥来自 `AA_RELEASE_SIGNING_KEY`）。

verifier 失败即 `rc:check` 失败。

## 6. Seeded Defect 测试

每个 P0 audit gate 必须在 `tests/fixtures/seeded-defects/<category>/` 下至少有：

```text
positive.*   真实问题样本（必须被 gate 抓到）
negative.*   正常代码样本（必须不被 gate 误报）
evasion.*    故意改写后的样本（必须仍被抓到）
```

manifest 写在 `tests/fixtures/seeded-defects/<category>/manifest.json`，匹配 `schemas/seeded-defect.schema.json`。`assurance:seeded-defects` 必须把 manifest 全部跑过，未通过的 gate 视为未通过。

## 7. 测试与 Assurance 边界

| 维度 | tests | assurance |
|---|---|---|
| 输入 | 代码执行结果 | 代码/文档/config/CI/历史承诺 |
| 输出 | pass/fail | issue/finding/report/gate/evidence |
| 何时跑 | PR + Nightly | Nightly + Release |
| 是否能阻断 release | 取决于 ci:baseline | 是 |

`tests/` 给出"实现能跑"证据，`assurance/` 给出"项目可被信任"证据，二者汇总到 `rc:check`。
