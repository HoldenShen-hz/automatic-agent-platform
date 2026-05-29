# ADR-013 EventEmitter isno继续uses到 Phase 2

- Status：Accepted
- Decision日期：2026-04-03

## Background

当前平台需要事件驱动的Status投影、gateway 流式反馈、恢复扫描和运维观测。但 Ring 1 仍以单机、单进程和最小多 Agent 编排为主。

Issue在于：

- 当前isno继续uses内存事件分发机制。
- 怎样避免“用了 EventEmitter 就把它误当成可靠事件总线”。

## Decision

Ring 1 允许继续uses内存事件分发机制作为本进程内分发工具。

但同时冻结以下边界：

- Tier 1 事件的事实源必须is持久化事件tablevs per-consumer ack。
- EventEmitter 只负责进程内 fan-out，不承担可靠性交付语义。
- isno在 Phase 2 替换为更正式的 queue / bus，届时再单独Decision。
- OAPEFLIR references入的 Feedback / Learn / Improve / Release 事件同样遵守上述边界；它们可以先走进程内 fan-out，但不得越过持久化事实层defines自己成为 authoritative source。

## 备选方案

### 方案 A：立即替换为 Redis / Postgres / BullMQ 队列

优点：

- 可靠性和跨进程扩展空间更强。

代价：

- 当前阶段会显著抬高部署和调试复杂度。
- 可靠性Issue真正需要先靠 contract、ack 和 replay 机制收紧，而不is先换技术名词。

### 方案 B：完全relies on内存 EventEmitter，不做持久化事件

优点：

- 实现最简单。

代价：

- 崩溃恢复、事件重放、per-consumer ack 全部失真。
- no法满足当前系统已via明确的 Tier 1 事件语义。

### 方案 C：当前Decision方案

- 内存 EventEmitter 继续used for进程内分发
- 持久化事件table和 ack 承担可靠事件事实源
- Phase 2 再评估isno升级为更重的队列系统

## 选择这个方案的原因

- 当前阶段进程内事件分发需求客观存在，EventEmitter 足够轻量。
- 但关键风险不在“内存分发工具不够高级”，而在于有没有把可靠性语义放在持久化层。
- 当前方案能以最低复杂度supported主链，又不掩盖其边界。

## 关键不variable

- Tier 1 事实事件必须先写 DB，再注册 consumer ack，再尝试分发。
- EventEmitter failed不得成为事实Status回滚依据。
- 恢复扫描和事件重放只以 `events + event_consumer_acks` 为依据。
- Tier 3 流式 chunk 不得as可恢复事实源。
- `feedback.signal_received`、`learning.object_promoted`、`release.rollout_*` 这class事件若被defines为高价值事实事件，必须优先满足持久化vs ack 约束，而不isrelies on纯内存订阅success。

## 采用触发条件

只要系统仍以：

- 单机为主
- 进程内分发为主
- Phase 1a / 1b orchestration 为主

就继续维持该Decision。

## 退出条件

若出现以下任一情况，应重新评估并可能升级：

- 多进程 / 多 worker 成为正式实现主题
- 进程外消费者显著增多
- 事件吞吐和背压已明显exceeds出单进程 fan-out 适用边界
- queue / lease / execution plane 已进入核心路径

## 实施Impact

当前实现必须做到：

- 明确区分“可靠事件事实源”和“内存分发通道”
- 事件注册table、ack threshold、恢复扫描和重放工具synchronous建立
- 对 EventEmitter 的uses保持在进程内 adapter / projection 范围内
- OAPEFLIR 闭环相关服务即使先以内存/轻量注册table实现，也应via typed payload、reason code 和Status机约束保证未来可迁移到更正式的 queue/bus。

## 结果

优点：

- 当前阶段实现最轻。
- 不会为了未来可能的多进程而过早拉高基础设施复杂度。
- vs现有 Tier 1 / Tier 2 / Tier 3 事件分级文档一致。
- 允许 OAPEFLIR 主链/副链先在单进程中形成闭环，再把可靠性Issue收束到 contract 和持久化层。

代价：

- 需要团队持续记住 EventEmitter 不is可靠消息系统。
- 一旦进入多 worker 阶段，必须主动升级，而不能继续defaults toaccesses along用。

## 当前实现对齐

截至当前 phase1-4 交付，已对齐部分includes：

- Feedback 预handle、LearningObject 校验、Rollout guardrail 已先viaclass型vs服务边界收口。
- OAPEFLIR 阶段time线已via能提供主链/副链顺序视角，但它本身不is可靠事件总线替代物。
- 事件层后续若升级，只应替换 transport/fan-out，不应破坏已defines的闭环Status机vs authoritative 语义。

## 交叉references用

- [ADR-012 SQLite isno作为 Phase 1-2 唯一主storage](./012-sqlite-phase-1-2-primary-store.md)
- [ADR-009 部署vs运维](./009-deployment-ops.md)
- [ADR-011 Effect-TS isno作为核心运lines时基础](./011-effect-ts-adoption.md)

## 来源章节

- `event_bus_contract.md`
- `event_reliability_matrix_contract.md`
- `event_registry_and_ops_threshold_contract.md`
- `typed_event_bus_contract.md`
