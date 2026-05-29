# ADR-111: Platform Fact vs OAPEFLIR View Events

- Status：Accepted
- Decision日期：2026-04-27

## Background

OAPEFLIR 在 v4.3 中is受控认知vs治理框架，不is第二套执lines运lines时。历史事件中 `oapeflir.*` 曾同时table达阶段语义、运lines事实和诊断视图，这会让 truth projector no法判断哪些事件可以改变权威Status。

## Decision

1. `platform.*` 事件is唯一 truth fact event namespace。
2. `oapeflir.view.*` vs `oapeflir.rationale.*` 只table达 StageRationale、TraceProjection、Audit View 和解释视图。
3. truth projector、recovery scanner、budget projector vs side-effect projector 只能消费 `platform.*`。
4. OAPEFLIR view projector 可以消费 `platform.*` 并派生 `oapeflir.view.*`，但不得反向驱动 `HarnessRun`、`NodeRun`、`Budget` 或 `SideEffect` truth。
5. legacy event adapter 若接收历史 `oapeflir.*` 事件，必须标记 `derivedFromEventId`、`projectionOnly=true` vs兼容来源，不得as platform fact。

## 事件层级

| 层级 | namespace | 用途 | 可驱动 truth |
|---|-------|--------| --- |
| Platform fact | `platform.*` | Status推进、budget、审批、副作用、审计事实 | is |
| OAPEFLIR view | `oapeflir.view.*` | 阶段视图、解释time线、诊断投影 | no |
| OAPEFLIR rationale | `oapeflir.rationale.*` | 认知理由、评估解释、学习发布Description | no |
| Legacy event | 历史 `task.*` / `workflow.*` / `oapeflir.*` | 兼容读取或迁移输入 | no，除非via显式 adapter 转换为 platform fact |

## Consequences

- 新增 event consumer test：truth consumer 不消费 `oapeflir.view.*`。
- Event registry 必须登记 producer、consumer、replay vs projection 语义。
- Trace Replay 以 platform facts 为defaults to审计能力；Re-execution Replay 的输出只能进入隔离 evidence namespace。

## 关联文档

- [109-contract-freeze.md](./109-contract-freeze.md)
- [event_registry_and_ops_threshold_contract.md](../contracts/event_registry_and_ops_threshold_contract.md)
- [event-envelope-contract.md](../contracts/event-envelope-contract.md)
