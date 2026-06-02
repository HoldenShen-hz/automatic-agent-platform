# v4.3 Event Envelope Contract

> v4.3 canonical contract。覆盖 `EventEnvelope` / `PlatformFactEvent` / `OapeflirViewEvent`。

## 1. 范围

事件系统分为 truth fact 与 view projection。`platform.*` 是唯一 truth fact namespace；`oapeflir.view.*` 与 `oapeflir.rationale.*` 只表达 OAPEFLIR 语义投影、解释和审计视图。

## 2. EventEnvelope

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `eventId` | `string` | 事件 ID |
| `runId` | `string` | 所属 run / lifecycle 关联 ID |
| `eventType` | `string` | 事件类型 |
| `schemaVersion` | `number` | executable contract schema 版本号 |
| `aggregateType` | `string` | 聚合类型 |
| `aggregateId` | `string` | 聚合 ID |
| `aggregateSeq` | `number` | 聚合序列 |
| `tenantId` | `string` | 租户 |
| `traceId` | `string` | trace |
| `causationId` | `string?` | 直接触发该事件的上游事件或命令 ID |
| `correlationId` | `string?` | 关联链 |
| `payloadHash` | `string` | payload hash |
| `payload` | `json` | payload |
| `replayBehavior` | `replay_as_fact \| skip_side_effect \| simulate \| forbidden` | replay 语义 |
| `sourceOfTruth` | `platform \| projection?` | truth / projection 来源标记 |
| `schemaOwner` | `string?` | schema owner |
| `consumerContractTests` | `string[]?` | 消费方 contract tests 标识 |
| `occurredAt` | `RFC3339 timestamp` | 发生时间 |

说明：

- v4.3 executable contract 使用 camelCase，并以 `schemaVersion:number` 作为 canonical 形态。
- 历史 `schema_version`、`eventVersion`、`idempotency_key`、`partition_key`、`ttl` 只允许作为 adapter / migration 输入，不再是当前 executable contract 的最小字段。
- executable contract validation 入口按 `additionalProperties: false` 拒绝未知顶层字段；旧 snake_case 字段不会作为 canonical payload 被接受。

规则：

- `(aggregateType, aggregateId, aggregateSeq)` 必须唯一。
- `occurredAt` 必须是 RFC3339 / ISO-8601 带时区时间戳。
- Tier 1 platform fact 必须支持 per-consumer ack 与 replay。
- event append 必须与 truth mutation 同事务。

## 3. PlatformFactEvent

`PlatformFactEvent` 是 `eventType` 以 `platform.` 开头的事实事件。

首批 namespace：

- `platform.harness_run.*`
- `platform.plan_graph.*`
- `platform.graph_patch.*`
- `platform.node_run.*`
- `platform.node_attempt.*`
- `platform.side_effect.*`
- `platform.budget.*`
- `platform.decision.*`
- `platform.hitl.*`
- `platform.version_lock.*`

规则：

- truth projector、recovery scanner、budget projector、side-effect projector 只能消费 `platform.*`。
- `PlatformFactEvent` 在 executable schema 中额外要求 `source` 与非空 `correlationId`。
- platform fact 不得由 UI view projector 直接生成；必须来自状态机、admission、scheduler、budget、side-effect、decision 等权威路径。
- `platform.*` namespace 约束由 `PlatformFactEvent` 子类型负责；基础 `EventEnvelope` 保持通用，便于 adapter / projection 共用。

## 4. OapeflirViewEvent

`OapeflirViewEvent` 是 `eventType` 以 `oapeflir.view.` 或 `oapeflir.rationale.` 开头的投影事件。

用途：

- StageRationale。
- TraceProjection。
- Audit View。
- 解释时间线。
- learning / improve / release 语义视图。

规则：

- 不得驱动 `HarnessRun`、`NodeRun`、`BudgetLedger`、`SideEffectRecord` truth mutation。
- 当前 executable contract 只接受 `derivedFromEventIds:string[]`，且至少包含 1 个来源 fact。
- 可以丢失后重建；不得作为唯一审计事实。

## 5. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `task.*` | legacy event；迁移后应投影或转换为 `platform.harness_run.*` |
| `workflow.*` | legacy event；新运行事实使用 `platform.*` |
| `oapeflir.*` | 默认 projection；只有显式 adapter 转换后才可能成为 platform fact |
| `dispatch:*` / `worker:*` | 运行诊断或平台事实取决于注册表声明；truth consumer 只看 `platform.*` |

## 6. 测试要求

- truth consumer 不消费 `oapeflir.view.*`。
- OAPEFLIR view event 必须带来源 fact。
- platform fact replay 能重建 HarnessRun / NodeRun / Budget / SideEffect read model。
- 未登记 event type 的生产必须在启动巡检或测试中失败。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-5: 早期文档把架构草案中的 envelope 元数据直接写成 canonical 字段，和当前 executable contract 脱节。修复：本文已明确 v4.3 executable contract 的实际最小字段，并把 `schema_version` / `idempotency_key` / `partition_key` / `ttl` 收口为历史 adapter 语义，而非当前 canonical payload。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
