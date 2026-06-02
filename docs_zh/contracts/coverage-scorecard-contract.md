# Audit Coverage Scorecard 契约

> 版本：v1.0  
> 状态：Required by `assurance:coverage-scorecard` 与 `rc:check`  
> 配套 schema：`schemas/coverage-scorecard.schema.json`  
> 关联文档：方法论 §30, §35

## 1. 目的

Coverage Scorecard 用于量化"每个 P0 问题域"在六维度上的覆盖情况，避免"跑了很多 script 但 P0 域未覆盖"的假象。

scorecard **不是** release 的充分条件；它只用于暴露盲区、给出 P0 blocker 的统一入口。

## 2. 十个维度

| 维度 | 含义 | 计算方法 |
|---|---|---|
| `sourceInventory` | src/ tests/ docs/ scripts/ config/ 是否全量纳入 inventory | inventory 文件数 / 仓库 git tracked 文件数 |
| `historicalPromise` | reference/release/ADR 中的 must/done/final 是否被抽取 | 已抽取的 promise 数 / 文档 grep 命中的 promise 数 |
| `contractSync` | contract docs / TS type / Zod / JSON schema / runtime 是否 N-way 对账 | 通过对账的 contract 数 / P0 contract 总数 |
| `securityAudit` | tenant/secret/plugin/SSRF 是否被 audit + regression seed 覆盖 | 命中种子的 P0 audit 数 / P0 audit 维度数 |
| `executionInvariant` | queue/idempotency/lease/side-effect 是否在 tests/invariants | 存在的 P0 invariant test 数 / P0 invariant 列表 |
| `evalOracle` | expected-as-actual / judge 读自评分 / dataset 无 samples 是否被 audit 抓到 | 通过 eval-oracle-auditor 的反例数 / 文档 §12.1 列的禁模式数 |
| `ciGate` | P0 audit 是否在 `ci:baseline` 或 `rc:check` | 接管的 P0 audit 数 / P0 audit 数 |
| `regressionSeed` | 历史 P0 issue 是否映射到 regression test | 已映射的 issueId 数 / issue ledger 中 P0 数 |
| `releaseClaim` | final/production-ready/industry-leading 是否带 evidenceRef | 带 evidenceRef 的 claim 数 / claim 总数 |
| `auditToolSelfTest` | 每个 audit script 是否有 positive/negative/evasion seed | 有 3 类种子的 audit 数 / audit 总数 |

每个维度返回 `{status, score, threshold, details, evidenceRefs?}`，schema 详见 `coverage-scorecard.schema.json`。

## 3. status 规则

```text
score >= threshold            -> pass
threshold * 0.7 <= score < threshold  -> warn
score < threshold * 0.7        -> fail
```

`overallStatus` 取所有维度的最差值；`releaseBlocked` 在 `overallStatus === fail` 时为 true。

## 4. P0 release 最低要求

```text
sourceInventory.score      >= 1.0
historicalPromise.score    >= 0.95
contractSync.score        >= 1.0 (P0 contracts 100%)
securityAudit.score       >= 1.0
executionInvariant.score   >= 1.0 (P0 invariants 100%)
evalOracle.score          >= 1.0
ciGate.score              >= 1.0
regressionSeed.score      >= 1.0 (P0 issues 100%)
releaseClaim.score        >= 1.0
auditToolSelfTest.score   >= 1.0
```

任一维度 score < threshold，`rc:check` 立即失败。

## 5. 输出

```text
artifacts/assurance/audit-coverage-scorecard.json
artifacts/assurance/audit-coverage-scorecard.md
```

`md` 版本给人类，`json` 版本给 `rc:check` 阻断判定使用。
