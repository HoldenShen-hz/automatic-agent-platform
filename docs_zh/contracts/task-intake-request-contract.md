# v4.3 Task Intake And Request Contract

> v4.3 canonical contract。覆盖 `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope`。

## 1. 范围

本 contract 定义从原始输入进入 HarnessRuntime 前的唯一 intake 链路：

```text
RawInput -> TaskDraft -> ClarificationSession -> ConfirmedTaskSpec -> RequestEnvelope
```

自然语言、Webhook、UI、CLI、定时触发器或外部事件不得直接生成可执行请求；只有 `ConfirmedTaskSpec` 可以生成 `RequestEnvelope`。

## 2. TaskDraft

`TaskDraft` 是 pre-admission 草稿，只能用于澄清、风险预览、保存用户意图和形成确认材料，不得进入 P4 执行。

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `taskDraftId` | `string` | 草稿 ID |
| `tenantId` | `string` | 租户 |
| `principal` | `PrincipalRef` | 发起主体 |
| `source` | `nl \| webhook \| ui \| cli \| scheduler \| external_event` | 输入来源 |
| `rawInputRef` | `ArtifactRef?` | 原始输入引用；大文本必须 artifact 化 |
| `domainId` | `string` | 领域 ID；draft 阶段也必须确定归属域 |
| `normalizedIntent` | `json` | 结构化意图 |
| `missingFields` | `string[]` | 仍需澄清字段 |
| `riskPreview` | `RiskPreview` | 初步风险判断 |
| `ambiguityPolicy` | `safe_default \| require_confirmation \| reject` | 歧义处理策略 |
| `createdAt` | `timestamp` | 创建时间 |
| `expiresAt` | `timestamp?` | 草稿过期时间 |

约束：

- `TaskDraft` 不分配 worker、不创建 `HarnessRun`、不占用执行预算。
- high / critical 风险草稿必须形成显式确认材料。
- 草稿过期后不得复用生成 `RequestEnvelope`，必须重新确认。

## 3. ConfirmedTaskSpec

`ConfirmedTaskSpec` 是唯一可转换为 `RequestEnvelope` 的前置对象。

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `confirmedTaskSpecId` | `string` | 已确认任务规格 ID |
| `taskDraftId` | `string` | 来源草稿 |
| `tenantId` | `string` | 租户 |
| `principal` | `PrincipalRef` | 发起主体 |
| `domainId` | `string` | 领域 ID |
| `goal` | `string` | 用户确认后的目标 |
| `inputs` | `json` | 已确认输入 |
| `constraintPackRef` | `ConstraintPackRef` | 任务级约束包引用 |
| `riskClass` | `low \| medium \| high \| critical` | 风险级别 |
| `confirmationReceipt` | `UserConfirmationReceipt?` | high / critical 必填 |
| `idempotencyKey` | `string` | 幂等键 |
| `traceId` | `string` | 全链路 trace |
| `createdAt` | `timestamp` | 创建时间 |

约束：

- `riskClass=high|critical` 时，`confirmationReceipt` 必须存在且未过期。
- `idempotencyKey` 在同一 tenant 下必须稳定；重复提交返回同一 admission 结果。
- `constraintPackRef` 必须来自平台、租户、域和任务约束合并后的不可变引用。

## 4. RequestEnvelope

`RequestEnvelope` 是 P1/P2 向 HarnessRuntime admission 传递的 canonical request。

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `requestId` | `string` | 请求 ID |
| `confirmedTaskSpecId` | `string` | 已确认任务规格 |
| `tenantId` | `string` | 租户 |
| `principal` | `PrincipalRef` | 发起主体 |
| `domainId` | `string` | 领域 ID |
| `traceId` | `string` | trace |
| `idempotencyKey` | `string` | 幂等键 |
| `priority` | `number` | admission 优先级 |
| `requestHash` | `string` | admission 幂等校验 hash |
| `constraintPackRef` | `ConstraintPackRef` | 约束包 |
| `budgetIntent` | `BudgetIntent` | 预算意图，不是 reservation |
| `policyContext` | `PolicyContext` | 策略上下文 |
| `artifactRefs` | `ArtifactRef[]` | 输入 artifact |
| `submittedAt` | `timestamp` | 提交时间 |

约束：

- `RequestEnvelope` 不得包含未确认的自然语言原文作为唯一任务定义。
- `budgetIntent` 只能进入预算预检；实际扣留必须通过 `BudgetReservation`。
- admission 成功后创建 `HarnessRun`；失败必须记录 platform fact event 与可解释拒绝原因。

## 5. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `Task` | 查询兼容层；新执行入口必须先形成 `TaskDraft` 或 `ConfirmedTaskSpec` |
| `TaskSpec` | 若无确认 receipt，不等价于 `ConfirmedTaskSpec` |
| `task.created` | legacy event；新事实事件使用 `platform.harness_run.*` 或 intake 相关 `platform.*` |
| 原始 prompt / raw text | 只能作为 `rawInputRef` 或 audit evidence，不得直达执行 |

## 6. 测试要求

- high / critical 风险无确认时拒绝生成 `RequestEnvelope`。
- 同一 `idempotencyKey + requestHash` 重复提交不得创建多个 `HarnessRun`。
- `TaskDraft` 不得被 P4 dispatch 消费。
- 旧 `/api/v1/tasks` 兼容入口必须投影到 v4.3 intake 链路。

## v4.3 Architecture Remediation

以下条目修复 contract 与 executable intake model 的命名漂移。本文档历史段落如与本节冲突，以 `src/platform/contracts/executable-contracts/` 为准。

- 本文此前延续了旧 `constraints` 命名并遗漏 `domainId` / `priority`。修复：本文已与当前 executable intake contracts 对齐，旧命名仅作历史语义说明。
