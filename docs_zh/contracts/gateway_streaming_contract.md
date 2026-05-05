# Gateway Streaming Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 release
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义 CLI、Web、Telegram 等渠道的流式输出、事件分发、帧格式与进度更新规范。

## 2. 关键对象

- `StreamEventFrame`
- `SseFrame`
- `StreamReplayWindow`
- `StreamReplayResult`

## 3. StreamEvent 最小字段

- `stream_id`
- `harness_run_id`
- `node_run_id?`
- `task_id?`
- `channel`
- `event_type`
- `sequence`
- `payload`
- `created_at`

## 4. event_type 枚举

- `status_changed`
- `progress`
- `message_delta`
- `artifact_ready`
- `approval_requested`
- `completed`
- `failed`

## 5. SSE 帧格式

Ring 1 基线统一使用：

- `id`: `<stream_id>:<sequence>`
- `event`: `event_type`
- `data`: JSON，至少包含 `stream_id`、`harness_run_id`、`sequence`、`payload`

规则：

- SSE 客户端按 `id` 支持断点续传或最小恢复。
- `completed` 和 `failed` 为终态帧。
- `sequence` 必须单调递增且不回退。

推荐运行规则：

- reconnect 应使用指数退避，避免断连时放大流量抖动。
- `401 / 403 / 404` 这类永久拒绝默认不得无限重试。
- 应维护 liveness timeout；长时间只收不到 keepalive / frame 时，应主动断开并进入恢复。
- 对“会话暂时未找到 / compaction 暂停发流 / generation 切换”这类可恢复场景，应设置有限重试预算，而不是无限重试或立即判死。
- 若支持 `Last-Event-ID` 或等价续流机制，应定义 replay buffer 窗口；客户端落后过多且所需事件已被驱逐时，服务端必须返回明确错误，而不是静默丢帧后继续。

## v4.3 Contract Remediation

- T-66: 本文原先把 `task_id` 定义为流式事件主锚点并使用 `Phase 1a` 口径，根因是 streaming contract 沿用了任务级 gateway 模型，没有同步到 `HarnessRun / NodeRun` 与 ring 口径。修复：正文现改为 `harness_run_id / node_run_id` 主链，`task_id` 仅保留聚合视图用途。

## 6. WebSocket 兼容策略

- WebSocket payload 与 SSE `data` 保持同一 JSON 结构。
- WebSocket 可以多路复用多个 `stream_id`，但每个 `stream_id` 仍独立递增。
- 若客户端不支持增量消费，允许服务端聚合后发送 `progress` / `completed` 帧。

## 7. Telegram 与非流式回退策略

- Telegram 默认不要求真正逐 token 流式输出。
- Phase 1a 允许用阶段性 `progress` 消息 + 最终结果消息替代完整流。
- 若出现 `approval_requested`，必须优先保证交互可达，而不是继续输出增量文本。

## 8. 行为约束

- 同一 `stream_id` 内 `sequence` 必须单调递增。
- `completed` 和 `failed` 为终态 chunk。
- 流式输出只能表达展示语义，不得绕过任务状态事实源。
- 渠道断连后必须可基于 `stream_id` 进行恢复、重放或阶段性回退。
- session / channel 状态只能表达交互进度，不得替代 task、workflow 或 execution 的 authoritative 状态。
- transport 重建后，应沿用 `last_sequence` 或等价 high-water mark 继续续流，而不是从 0 全量重放。

## 9. 补充规则

- 多窗口订阅同一 `stream_id` 时，以 `stream_id + sequence` 去重，重复帧允许安全忽略。
- CLI TTY 与 Web SSE 的背压都应优先丢弃可重建的中间 `progress`，不得丢弃终态帧。
- keepalive / comment 帧可以只用于 liveness，不应进入业务事件主链。
- transport 层状态至少区分 `connected / reconnecting / failed`；观察者订阅与拥有执行权的订阅不得混淆。
- 如支持只读观察者模式，可增加 `viewer_only` 或等价交互态，但该状态只能表达权限受限观察，不得被误用为业务失败。
- 若客户端存在显示层 commit tick / catch-up 机制，应只依据 backlog 深度、最老消息年龄等队列状态工作，不得因上游来源不同而重排或改变业务语义。
- replay/live 双通道衔接时，应先建立 live 订阅再快照 replay buffer，并以 `replay_max_sequence` 或等价高水位去重，避免在 replay 与 live 之间出现丢缝或重复推进。
- 对交互型 session/channel，建议限制同一交互上下文的并发活跃请求数；若存在 active request guard，其语义只能约束交互提交，不得替代 task/execution 所有权控制。
