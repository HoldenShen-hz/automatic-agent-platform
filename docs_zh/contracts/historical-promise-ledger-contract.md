# Historical Promise Ledger 契约

> 版本：v1.0  
> 配套 schema：`schemas/historical-promise-ledger.schema.json`  
> 关联入口：`npm run assurance:historical-promises`

## 1. 目标

把历史文档中的 `must / should / done / final / production-ready / industry-leading` 等承诺恢复成 machine-readable ledger，避免 release claim 只存在 prose 中。

## 2. 输出

脚本 `scripts/assurance/collect-historical-promises.mjs` 必须生成：

```text
artifacts/assurance/historical-promises.jsonl
artifacts/assurance/historical-promise-drift-report.json
artifacts/assurance/historical-promise-drift-report.md
```

其中 `historical-promises.jsonl` 的每一行都必须满足 `schemas/historical-promise-ledger.schema.json`。

## 3. 最小字段

每条 promise 至少必须包含：

```text
promiseId
sourceFile
sourceSection
promiseText
promiseType
status
claimStrength
owner
evidenceRefs
expiry
```

## 4. Fail-closed 规则

以下任一成立，promise 不能被视为 release-ready evidence：

```text
强 claim 没有 evidenceRefs
claim status 无法映射到受支持枚举
sourceFile/sourceSection 无法反向追溯
expiry 已过期
claim 指向 final/production-ready/industry-leading 但 drift report 仍未闭合
```

## 5. 与 Release Gate 的关系

`rc:check` 必须消费 historical promise drift 结果。以下情况至少作为 release blocker 或 observe-mode blocker 进入 `artifacts/release/rc-check-report.json`：

```text
release claim unverified
strong claim without evidence bundle
expired claim still marked done/final
```
