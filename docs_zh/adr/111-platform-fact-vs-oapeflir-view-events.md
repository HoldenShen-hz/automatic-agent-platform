# ADR-111: Platform Fact vs OAPEFLIR View Events

## 状态

Accepted

## 决策日期

2026-04-27

## 背景

OAPEFLIR 在 v4.3 中是受控认知与治理框架，不是第二套执行运行时。历史事件中 `oapeflir.*` 曾同时表达阶段语义、运行事实和诊断视图，这会让 truth projector 无法判断哪些事件可以改变权威状态。

## 决策

1. `platform.*` 事件是唯一 truth fact event namespace。
2. `oapeflir.view.*` 与 `oapeflir.rationale.*` 只表达 StageRationale、TraceProjection、Audit View 和解释视图。
3. truth projector、recovery scanner、budget projector 与 side-effect projector 只能消费 `platform.*`。
4. OAPEFLIR view projector 可以消费 `platform.*` 并派生 `oapeflir.view.*`，但不得反向驱动 `HarnessRun`、`NodeRun`、`Budget` 或 `SideEffect` truth。
5. legacy event adapter 若接收历史 `oapeflir.*` 事件，必须标记 `derivedFromEventId`、`projectionOnly=true` 与兼容来源，不得伪装成 platform fact。

## 事件层级

| 层级 | namespace | 用途 | 可驱动 truth |
| --- | --- | --- | --- |
| Platform fact | `platform.*` | 状态推进、预算、审批、副作用、审计事实 | 是 |
| OAPEFLIR view | `oapeflir.view.*` | 阶段视图、解释时间线、诊断投影 | 否 |
| OAPEFLIR rationale | `oapeflir.rationale.*` | 认知理由、评估解释、学习发布说明 | 否 |
| Legacy event | 历史 `task.*` / `workflow.*` / `oapeflir.*` | 兼容读取或迁移输入 | 否，除非经显式 adapter 转换为 platform fact |

## 后果

- 新增 event consumer test：truth consumer 不消费 `oapeflir.view.*`。
- Event registry 必须登记 producer、consumer、replay 与 projection 语义。
- Trace Replay 以 platform facts 为默认审计能力；Re-execution Replay 的输出只能进入隔离 evidence namespace。

## 关联文档

- [109-v4.3-contract-freeze.md](./109-v4.3-contract-freeze.md)
- [event_registry_and_ops_threshold_contract.md](../contracts/event_registry_and_ops_threshold_contract.md)
- [v4_3_event_envelope_contract.md](../contracts/v4_3_event_envelope_contract.md)
