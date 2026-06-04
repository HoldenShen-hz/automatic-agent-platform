# Issue Ledger 契约

> 版本：v1.0  
> 状态：Required by `assurance:issue-ledger` 与 `rc:check`  
> 配套 schema：`schemas/issue-ledger.schema.json`  
> 关联文档：`docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md` §1.5, §20.10, §29

## 1. 范围

本契约规定 Automatic Agent Platform 在 `assurance:full` / `assurance:issue-ledger` / `rc:check` 流程中产出的 **Issue Ledger** 记录的字段、约束和生成/消费规则。

Issue Ledger 是 P0/P1 issue 的唯一机器可读载体。任何 audit script、review、release claim、historical promise 发现的问题都必须能反向追溯到一条 `AAS-ISSUE-…` 记录。

## 2. 物理产物

| 路径 | 说明 |
|---|---|
| `artifacts/assurance/issues.raw.jsonl` | raw findings，按发现顺序追加，不去重 |
| `artifacts/assurance/issues.normalized.jsonl` | 归一化后每行一条 issue，匹配 `issue-ledger.schema.json` |
| `artifacts/assurance/issues.deduped.jsonl` | 按 root cause + invariant 去重后的 ledger |
| `docs_zh/quality/issue-ledger/automatic-agent-system-issues.md` | 人工可读镜像，每周由 build-issue-ledger 重新生成 |

## 3. 必填字段

| 字段 | 必填 | 约束 |
|---|---|---|
| `issueId` | ✅ | `^AAS-ISSUE-[0-9]{6,}$` |
| `source` | ✅ | `code|doc|adr|release|test|ci|runtime|manual|audit|review` |
| `sourceRef` | ✅ | 至少定位到 `path:line` 或 `doc#anchor` |
| `category` | ✅ | 点号分隔，如 `security.tenant_isolation` |
| `severity` | ✅ | `P0\|P1\|P2\|P3` |
| `description` | ✅ | 自然语言，无空字符串 |
| `invariantViolated` | ✅ | 描述被破坏的不变量。无法识别时填 `unspecified` |
| `status` | ✅ | 见 §4 |
| `requiredTest` | ✅ | 至少包含 1 个测试类型（unit/integration/…） |
| `requiredGate` | ✅ | 至少包含 1 个 audit:* 或 test:* gate |
| `owner` | ❌ | 缺失时填 `TBD`；release 前必须收敛 |
| `coverageRequired` | ❌ | `true/false`。`false` 表示该 issue 仅保留追溯，不再参与当前 release coverage gate |
| `coverageReason` | ❌ | 当 `coverageRequired=false` 时必填，解释为何仅保留追溯 |

## 3.1 Active Coverage 与 Traceability-only 的分层

Issue Ledger 不再默认把所有历史 finding 都当作当前 release blocker。实现时必须区分两类记录：

```text
coverageRequired=true
  参与 assurance:verify-test-coverage
  参与 coverage-scorecard 的 active issue coverage 计算
  必须通过 gate / invariant / test 绑定

coverageRequired=false
  仅用于历史追溯、review 证据链和 promise lineage
  不作为当前 release gate 的 active blocker
  但仍必须保留 issueId / sourceRef / linkedReviewIds / linkedPromiseIds
```

允许进入 `coverageRequired=false` 的典型场景：

```text
review 已明确 fixed / verified / closed
review 被标记为 accepted_risk 且 owner/expiry 完整
历史问题需要保留 lineage，但当前代码/测试链已换代
旧 finding 仅作为审计样本存在，当前需要的是重新验证而不是继续阻断 release
```

常见 `coverageReason` 示例：

```text
historical_or_resolved_issue_kept_for_traceability_only
accepted_risk_with_compensating_control
superseded_by_newer_runtime_or_contract
manual_sample_for_audit_lineage_only
```

## 4. status 合法值与转换

```text
open
  ↓ fix landed + regression test green
in_progress
  ↓ PR merged + evidence[] present
fixed
  ↓ audit tool self-test passes + independent reviewer sign-off
verified
  ↓ (or 走 accepted_risk 分支)
accepted_risk          // 必须有 owner + expiry
needs_revalidation     // 时间窗口过期、regression 失败、上下文漂移
closed                 // 仅在 verified 后才能进入
```

## 5. 与 review-ledger / historical-promise-ledger 的关系

| 来源 | 标识符 | 关联字段 |
|---|---|---|
| Review | `AAS-REVIEW-SRC-…` | `linkedReviewIds[]` |
| Historical promise | `AAS-PROMISE-…` | `linkedPromiseIds[]` |
| Audit finding | `audit:<scanner>:<rule>` | `sourceRef` + `requiredGate[0]` |

`build-issue-ledger.mjs` 必须把 `review-ledger.normalized.jsonl` 与 `historical-promises.jsonl` 合并生成 normalized issues；任何一条都没有反向映射的 review / promise 记录都必须报错。

此外，`build-issue-ledger.mjs` 必须负责把 review/historical/audit finding 归类成：

```text
active coverage issue      -> coverageRequired=true
traceability-only issue    -> coverageRequired=false
```

并保证 `coverageReason` 与 `status` 一致，不允许出现：

```text
status=open 但 coverageRequired=false 且无依据
status=verified/closed 但 coverageRequired=true 且没有 active regression 需要
accepted_risk 但 coverageReason 缺失
```

## 6. 禁止关闭条件

issue 进入 `closed` 状态必须同时满足：

```text
status === verified
regression test 通过 (requiredTest 中至少 1 条)
audit gate 包含在 ci:baseline 或 rc:check
evidence[] 非空
owner 非 TBD
linkedPromiseIds / linkedReviewIds 中至少 1 条
```

`accepted_risk` 关闭必须有：`owner`、`expiry`、`fixStrategy` 描述的补偿控制。

## 7. 反向追溯

每个 issue 必须能被以下查询反查到：

```bash
rg -n "AAS-ISSUE-000001" src/ tests/ docs_zh/ scripts/ artifacts/ ui/
```

未找到任何 `AAS-ISSUE-…` 引用的 issue 视为"无下游绑定"，由 `coverage-scorecard` 标记为 P0 regression gap。
