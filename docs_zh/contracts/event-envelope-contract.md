# v4.3 Event Envelope Contract

> v4.3 canonical contract。覆盖 `EventEnvelope` / `PlatformFactEvent` / `OapeflirViewEvent`。

## 1. 范围

事件系统分为 truth fact 与 view projection。`platform.*` 是唯一 truth fact namespace；`oapeflir.view.*` 与 `oapeflir.rationale.*` 只表达 OAPEFLIR 语义投影、解释和审计视图。

## 2. EventEnvelope

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `eventId` | `string` | 事件 ID |
| `runId` | `string` | 运行链锚点；通常为 `harnessRunId` 或与 aggregate 对齐的稳定 run 级 ID |
| `eventType` | `string` | 事件类型 |
| `schemaVersion` | `number` | 事件 schema 版本；v4.3 canonical 为数字版本而不是字符串 |
| `aggregateType` | `string` | 聚合类型 |
| `aggregateId` | `string` | 聚合 ID |
| `aggregateSeq` | `number` | 聚合序列 |
| `tenantId` | `string` | 租户 |
| `traceId` | `string` | trace |
| `payloadHash` | `string` | payload hash |
| `payload` | `json` | payload |
| `replayBehavior` | `replay_as_fact \| skip_side_effect \| simulate \| forbidden` | replay 行为声明 |
| `occurredAt` | `timestamp` | 发生时间 |
| `idempotencyKey` | `string?` | 生产侧幂等键；用于 append / relay / consumer 去重 |
| `causationId` | `string?` | 直接触发该事件的上游事件或命令 ID |
| `correlationId` | `string?` | 关联链 |
| `partitionKey` | `string?` | 分区路由键；同一 truth aggregate 应稳定路由到同一分区策略 |
| `ttl` | `duration?` | 保留/失效提示；用于 relay、cache、view rebuild 或临时投影过期策略 |

canonical 兼容映射：

| legacy / wire alias | v4.3 canonical 字段 |
| --- | --- |
| `schema_version` | `schemaVersion` |
| `event_version` | `schemaVersion` |
| `idempotency_key` | `idempotencyKey` |
| `causation_id` | `causationId` |
| `partition_key` | `partitionKey` |
| `payload_hash` | `payloadHash` |
| `occurred_at` | `occurredAt` |

规则：

- v4.3 canonical schema 只使用 camelCase；snake_case 只允许出现在 wire adapter、导入兼容层或历史迁移说明中，不得与 canonical 字段并列定义为同一层 schema。
- `(aggregateType, aggregateId, aggregateSeq)` 必须唯一。
- `runId`、`schemaVersion`、`replayBehavior` 是 canonical EventEnvelope 的权威字段，不得在新实现中省略。
- 若入口仍提供 `schema_version`、`idempotency_key` 或其他 snake_case alias，必须在进入 canonical event bus 前归一化到 camelCase。
- `ttl` 只控制 envelope 生命周期策略，不得改变已提交 truth fact 的审计保留义务。
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

补充 truth namespace（truth projector、recovery scanner、budget projector、side-effect projector 只能消费 `platform.*`）：

- `platform.release.*` — release/rollout 状态变更属于 truth fact，必须使用 `platform.release.*`
- `platform.approval.*` — approval 状态变更属于 truth fact
- `platform.feedback.*` — feedback signal 属于 truth fact
- `platform.learn.*` — learning 对象创建/晋升属于 truth fact
- `platform.improve.*` — improve candidate 属于 truth fact
- `platform.loop.*` — OAPEFLIR loop iteration 状态属于 truth fact

规则：

- truth projector、recovery scanner、budget projector、side-effect projector 只能消费 `platform.*`。
- platform fact 不得由 UI view projector 直接生成；必须来自状态机、admission、scheduler、budget、side-effect、decision 等权威路径。

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
- 必须声明 `derivedFromEventId` 或 `derivedFromEventIds`。
- 可以丢失后重建；不得作为唯一审计事实。

## 5. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `task.*` | legacy event；迁移后应投影或转换为 `platform.harness_run.*` |
| `workflow.*` | legacy event；新运行事实使用 `platform.*` |
| `release.*` / `approval.*` / `feedback.*` / `learn.*` / `improve.*` / `loop.*` | 若承载 truth fact，必须归一化到 `platform.release.*` / `platform.approval.*` / `platform.feedback.*` / `platform.learn.*` / `platform.improve.*` / `platform.loop.*`；裸 namespace 只允许作为历史投影或 adapter 输入 |
| `oapeflir.*` | 默认 projection；只有显式 adapter 转换后才可能成为 platform fact |
| `dispatch:*` / `worker:*` | 运行诊断或平台事实取决于注册表声明；truth consumer 只看 `platform.*` |

## 6. 测试要求

- truth consumer 不消费 `oapeflir.view.*`。
- OAPEFLIR view event 必须带来源 fact。
- platform fact replay 能重建 HarnessRun / NodeRun / Budget / SideEffect read model。
- 未登记 event type 的生产必须在启动巡检或测试中失败。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-5: 缺少架构 ContractEnvelope 要求的 5 个必需字段：`schema_version/idempotency_key/causation_id/partition_key/ttl`。根因：早期文档只描述了事件事实存储字段，遗漏了 envelope 层的幂等、分区和生命周期元数据。修复：这些字段现通过 canonical `schemaVersion/idempotencyKey/causationId/partitionKey/ttl` 与 alias 映射一并冻结；snake_case 只允许作为 adapter / migration 输入，不得再和 canonical schema 混写。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
