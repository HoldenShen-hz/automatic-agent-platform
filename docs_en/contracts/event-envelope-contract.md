# v4.3 Event Envelope Contract

> v4.3 canonical contract。覆盖 `EventEnvelope` / `PlatformFactEvent` / `OapeflirViewEvent`。

## 1. 范围

事件系统分为 truth fact vs view projection。`platform.*` is唯一 truth fact namespace；`oapeflir.view.*` vs `oapeflir.rationale.*` 只table达 OAPEFLIR 语义投影、解释和审计视图。

## 2. EventEnvelope

最小字段：

| 字段 | class型 | Description |
|---|-------|--------|
| `schema_version` | `string` | envelope wire schema 版本；used for跨storage、跨队列vs跨语言兼容 |
| `eventId` | `string` | 事件 ID |
| `eventType` | `string` | 事件class型 |
| `eventVersion` | `string` | 事件 schema 版本 |
| `idempotency_key` | `string` | 生产侧幂等键；used for append / relay / consumer for deduplication |
| `aggregateType` | `string` | 聚合class型 |
| `aggregateId` | `string` | 聚合 ID |
| `aggregateSeq` | `number` | 聚合序列 |
| `tenantId` | `string` | 租户 |
| `traceId` | `string` | trace |
| `causation_id` | `string?` | directly触发该事件的上游事件或命令 ID |
| `correlationId` | `string?` | 关联链 |
| `partition_key` | `string` | 分区路由键；同一 truth aggregate 必须稳定路由到同一分区策略 |
| `ttl` | `duration?` | 保留/失效提示；used for relay、cache、view rebuild 或临时投影过期策略 |
| `payloadHash` | `string` | payload hash |
| `payload` | `json` | payload |
| `occurredAt` | `timestamp` | 发生time |

规则：

- `(aggregateType, aggregateId, aggregateSeq)` 必须唯一。
- `schema_version`、`idempotency_key`、`partition_key` 缺一不可；缺失时不得进入 canonical event bus。
- `ttl` 只控制 envelope 生命cycle策略，不得改变已提交 truth fact 的审计保留义务。
- Tier 1 platform fact 必须supported per-consumer ack vs replay。
- event append 必须vs truth mutation 同事务。

## 3. PlatformFactEvent

`PlatformFactEvent` is `eventType` 以 `platform.` 开头的事实事件。

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
- platform fact 不得由 UI view projector directly生成；必须来自Status机、admission、scheduler、budget、side-effect、decision 等权威路径。

## 4. OapeflirViewEvent

`OapeflirViewEvent` is `eventType` 以 `oapeflir.view.` 或 `oapeflir.rationale.` 开头的投影事件。

用途：

- StageRationale。
- TraceProjection。
- Audit View。
- 解释time线。
- learning / improve / release 语义视图。

规则：

- 不得驱动 `HarnessRun`、`NodeRun`、`BudgetLedger`、`SideEffectRecord` truth mutation。
- 必须声明 `derivedFromEventId` 或 `derivedFromEventIds`。
- 可以丢失后重建；不得作为唯一审计事实。

## 5. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `task.*` | legacy event；迁移后应投影或转换为 `platform.harness_run.*` |
| `workflow.*` | legacy event；新运lines事实uses `platform.*` |
| `oapeflir.*` | defaults to projection；只有显式 adapter 转换后才可能成为 platform fact |
| `dispatch:*` / `worker:*` | 运lines诊断或平台事实取决于注册table声明；truth consumer 只看 `platform.*` |

## 6. 测试要求

- truth consumer 不消费 `oapeflir.view.*`。
- OAPEFLIR view event 必须带来源 fact。
- platform fact replay 能重建 HarnessRun / NodeRun / Budget / SideEffect read model。
- 未登记 event type 的生产必须在启动巡检或测试中failed。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-5: 缺少Architecture ContractEnvelope 要求的5个required字段：schema_version/idempotency_key/causation_id/partition_key/ttl。Root Cause：早期文档只Description了事件事实storage字段，遗漏了 envelope 层的幂等、分区和生命cycle元data。修复：这 5 个字段现已进入 `EventEnvelope` canonical 最小字段；旧 camelCase / 省略字段写法只能作为 adapter 或 migration 输入，不得作为新实现入口。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
