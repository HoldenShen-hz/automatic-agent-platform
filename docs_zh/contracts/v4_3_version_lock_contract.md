# v4.3 Version Lock Contract

> v4.3 canonical contract。覆盖 `RunVersionLock` / `ArtifactVersionLockSet`。

## 1. 范围

每个 `HarnessRun` 在 admitted 时冻结 `RunVersionLock`。运行中配置发布不得改变已运行 run 的语义；只能通过显式 GraphPatch、OperationalDirective、redrive 或新 HarnessRun 使用新版本。

## 2. RunVersionLock

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
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
| `createdAt` | `timestamp` | 冻结时间 |

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

- 输入、计划、prompt、tool output、receipt、audit evidence 中的大对象都必须可通过 artifact lock 追溯。
- artifact GC 不得早于审计保留窗口。
- Re-execution Replay 产物必须进入隔离 namespace，不得覆盖原 artifact lock。

## 4. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| latest config lookup | 禁止用于 active run truth |
| mutable artifact pointer | 必须替换为 artifact version lock |
| replay overwrite | 禁止；只能写隔离 evidence namespace |

## 5. 测试要求

- 配置发布不得改变 active `HarnessRun` 的 lock。
- GraphPatch lock 冲突必须按策略拒绝、重校验或重启。
- artifact hash 变化必须被检测为新版本。
