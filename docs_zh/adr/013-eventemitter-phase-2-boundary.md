# ADR-013 EventEmitter 是否继续使用到 Phase 2

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

当前平台需要事件驱动的状态投影、gateway 流式反馈、恢复扫描和运维观测。但 Phase 1a / 1b 仍以单机、单进程和最小多 Agent 编排为主。

问题在于：

- 当前是否继续使用内存事件分发机制。
- 怎样避免“用了 EventEmitter 就把它误当成可靠事件总线”。

## 决策

Phase 1a / 1b 允许继续使用内存事件分发机制作为本进程内分发工具。

但同时冻结以下边界：

- Tier 1 事件的事实源必须是持久化事件表与 per-consumer ack。
- EventEmitter 只负责进程内 fan-out，不承担可靠性交付语义。
- 是否在 Phase 2 替换为更正式的 queue / bus，届时再单独决策。
- OAPEFLIR 引入的 Feedback / Learn / Improve / Release 事件同样遵守上述边界；它们可以先走进程内 fan-out，但不得越过持久化事实层定义自己成为 authoritative source。

## 备选方案

### 方案 A：立即替换为 Redis / Postgres / BullMQ 队列

优点：

- 可靠性和跨进程扩展空间更强。

代价：

- 当前阶段会显著抬高部署和调试复杂度。
- 可靠性问题真正需要先靠 contract、ack 和 replay 机制收紧，而不是先换技术名词。

### 方案 B：完全依赖内存 EventEmitter，不做持久化事件

优点：

- 实现最简单。

代价：

- 崩溃恢复、事件重放、per-consumer ack 全部失真。
- 无法满足当前系统已经明确的 Tier 1 事件语义。

### 方案 C：当前决策方案

- 内存 EventEmitter 继续用于进程内分发
- 持久化事件表和 ack 承担可靠事件事实源
- Phase 2 再评估是否升级为更重的队列系统

## 选择这个方案的原因

- 当前阶段进程内事件分发需求客观存在，EventEmitter 足够轻量。
- 但关键风险不在“内存分发工具不够高级”，而在于有没有把可靠性语义放在持久化层。
- 当前方案能以最低复杂度支持主链，又不掩盖其边界。

## 关键不变量

- Tier 1 事实事件必须先写 DB，再注册 consumer ack，再尝试分发。
- EventEmitter 失败不得成为事实状态回滚依据。
- 恢复扫描和事件重放只以 `events + event_consumer_acks` 为依据。
- Tier 3 流式 chunk 不得伪装成可恢复事实源。
- `feedback.signal_received`、`learning.object_promoted`、`release.rollout_*` 这类事件若被定义为高价值事实事件，必须优先满足持久化与 ack 约束，而不是依赖纯内存订阅成功。

## 采用触发条件

只要系统仍以：

- 单机为主
- 进程内分发为主
- Phase 1a / 1b orchestration 为主

就继续维持该决策。

## 退出条件

若出现以下任一情况，应重新评估并可能升级：

- 多进程 / 多 worker 成为正式实现主题
- 进程外消费者显著增多
- 事件吞吐和背压已明显超出单进程 fan-out 适用边界
- queue / lease / execution plane 已进入核心路径

## 实施影响

当前实现必须做到：

- 明确区分“可靠事件事实源”和“内存分发通道”
- 事件注册表、ack 阈值、恢复扫描和重放工具同步建立
- 对 EventEmitter 的使用保持在进程内 adapter / projection 范围内
- OAPEFLIR 闭环相关服务即使先以内存/轻量注册表实现，也应通过 typed payload、reason code 和状态机约束保证未来可迁移到更正式的 queue/bus。

## 结果

优点：

- 当前阶段实现最轻。
- 不会为了未来可能的多进程而过早拉高基础设施复杂度。
- 与现有 Tier 1 / Tier 2 / Tier 3 事件分级文档一致。
- 允许 OAPEFLIR 主链/副链先在单进程中形成闭环，再把可靠性问题收束到 contract 和持久化层。

代价：

- 需要团队持续记住 EventEmitter 不是可靠消息系统。
- 一旦进入多 worker 阶段，必须主动升级，而不能继续默认沿用。

## 当前实现对齐

截至当前 phase1-4 交付，已对齐部分包括：

- Feedback 预处理、LearningObject 校验、Rollout guardrail 已先通过类型与服务边界收口。
- OAPEFLIR 阶段时间线已经能提供主链/副链顺序视角，但它本身不是可靠事件总线替代物。
- 事件层后续若升级，只应替换 transport/fan-out，不应破坏已定义的闭环状态机与 authoritative 语义。

## 交叉引用

- [ADR-012 SQLite 是否作为 Phase 1-2 唯一主存储](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-009 部署与运维](./009-deployment-ops.md)
- [ADR-011 Effect-TS 是否作为核心运行时基础](./011-effect-ts-adoption.md)

## 来源章节

- `event_bus_contract.md`
- `event_reliability_matrix_contract.md`
- `event_registry_and_ops_threshold_contract.md`
- `typed_event_bus_contract.md`
