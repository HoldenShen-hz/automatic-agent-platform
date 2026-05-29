# v4.3 Version Lock Contract

> v4.3 canonical contract。覆盖 `RunVersionLock` / `ArtifactVersionLockSet`。

## 1. 范围

每个 `HarnessRun` 在 admitted 时冻结 `RunVersionLock`。运lines中configure发布不得改变已运lines run 的语义；只能via显式 GraphPatch、OperationalDirective、redrive 或新 HarnessRun uses新版本。

## 2. RunVersionLock

最小字段：

| 字段 | class型 | Description |
|---|-------|--------|
| `runVersionLockId` | `string` | 版本锁 ID |
| `harnessRunId` | `string` | 所属 run |
| `schemaVersion` | `string` | contract / schema 版本 |
| `runtimeProfileVersion` | `string` | runtime profile |
| `promptVersions` | `Record<string,string>` | prompt 版本 |
| `policyVersions` | `Record<string,string>` | policy 版本 |
| `toolVersions` | `Record<string,string>` | tool / connector 版本 |
| `modelVersions` | `Record<string,string>` | model/provider 版本 |
| `evalVersions` | `Record<string,string>` | eval / judge 版本 |
| `guardrailVersions` | `Record<string,string>` | guardrail 版本 |
| `domainVersions` | `Record<string,string>` | domain / pack 版本 |
| `createdAt` | `timestamp` | 冻结time |

规则：

- admitted 后 `RunVersionLock` append-only，不得原地改写。
- GraphPatch 需要声明 `inherit_lock`、`revalidate_with_new_lock` 或 `force_restart`。
- `force_restart` 必须新建 `HarnessRun`。

## 3. ArtifactVersionLockSet

最小字段：

- `artifactVersionLockSetId`
- `harnessRunId`
- `artifactLocks[]`
- `createdAt`

`artifactLocks[]` 最小字段：

- `artifactId`
- `version`
- `hash`
- `storageUri`
- `retentionPolicyRef`

规则：

- 输入、计划、prompt、tool output、receipt、audit evidence 中的大对象都必须可via artifact lock 追溯。
- artifact GC 不得早于审计保留窗口。
- Re-execution Replay 产物必须进入隔离 namespace，不得覆盖原 artifact lock。

## 4. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| latest config lookup | 禁止used for active run truth |
| mutable artifact pointer | 必须替换为 artifact version lock |
| replay overwrite | 禁止；只能写隔离 evidence namespace |

## 5. 测试要求

- configure发布不得改变 active `HarnessRun` 的 lock。
- GraphPatch lock conflicts必须按策略拒绝、重校验或重启。
- artifact hash 变化必须被检测为新版本。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-4: onlysupported3种锁定策略（pinned/floating/range），Architecture§22.4defines4种含 digest-locked。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧Status、旧 DTO 或旧术语only允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
