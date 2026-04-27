# ADR-113: Architecture Implementation Audit Supersession

## 状态

Accepted

## 决策日期

2026-04-27

## 背景

`docs_zh/reviews/platform-architecture-implementation-consistency-audit.md` 重新复核了历史 ADR 与 `docs_zh/architecture/00-platform-architecture.md` 的一致性，发现 A-1 至 A-37 共 37 个 ADR 层面的历史偏差。按照 ADR 管理原则，已 Accepted 的历史 ADR 不直接改写正文；本 ADR 作为统一 supersession record，将这些历史偏差收束到 v4.3 canonical authority。

## 决策

1. ADR-109 是 v4.3 canonical contract freeze 的入口，取代历史 `ExecutionPlan` / `ExecutionReceipt` / `ControlDirective` / `StateCommand` 作为新实现入口的语义。
2. ADR-110 是 runtime state authority，要求所有 truth mutation 经 `RuntimeStateMachine.transition(command)`。
3. ADR-111 是 event namespace authority，规定 `platform.*` 为唯一 truth fact event，`oapeflir.view.*` 仅为投影。
4. ADR-112 是 MVP / Hardening / Enterprise 三环边界，禁止旧 Phase 命名或 v4.4 OAPEFLIR Runtime 口径反向定义 v4.3 implementation authority。
5. 本 ADR 记录 A-1 至 A-37 的逐项 supersession，不删除历史 ADR 内容，但历史 ADR 与本 ADR 冲突时，以 ADR-109 至 ADR-113 以及 `00-platform-architecture.md` 为准。

## 逐项收口矩阵

| 审计项 | 历史 ADR | 修复方式 | 权威依据 |
| --- | --- | --- | --- |
| A-1 | ADR-016 | OAPEFLIR 不再作为执行编排器，只保留认知投影语义 | ADR-111 |
| A-2 | ADR-029 | HarnessRuntime 是执行入口，OAPEFLIR 不拥有 runtime authority | ADR-110 / ADR-111 |
| A-3 | ADR-030 | 恢复与执行状态变更必须提交 RuntimeStateMachine transition | ADR-110 |
| A-4 | ADR-012 | `step` 仅为 legacy/projection，canonical 名称为 `NodeRun` / `NodeAttempt` | ADR-109 |
| A-5 | ADR-091 | `Rollout` 历史术语在新实现中收敛为 Release / Improvement release 语义 | ADR-112 |
| A-6 | ADR-109 | 沙箱与安全层级以 `00-platform-architecture.md` 和 executable contract 为准 | ADR-109 |
| A-7 | ADR-110 | ContextWindow 压缩必须引用 MemoryTier / retention / compaction gate | ADR-110 / ADR-112 |
| A-8 | ADR-111 | Plugin lifecycle 以 registered / validated / active / suspended / deprecated 为准 | ADR-111 |
| A-9 | ADR-112 | 跨区域复制采用 bounded staleness 与 single truth leader gate | ADR-112 |
| A-10 | ADR-016/029 | DTO 命名收敛为 CognitiveFrameInput / CognitiveFrameOutput；旧名只作 adapter | ADR-111 |
| A-11 | ADR-030 | 恢复超时按 NodeType 配置，不再使用固定 30s authority | ADR-110 |
| A-12 | ADR-091 | DeploymentSlot 历史概念收敛为 ReleaseChannel | ADR-112 |
| A-13 | ADR-021 | ControlDirective 旧语义由 OperationalDirective / DecisionDirective 替代 | ADR-109 |
| A-14 | ADR-021 | ExecutionPlan 线性 steps 由 PlanGraphBundle 替代 | ADR-109 |
| A-15 | ADR-021 | ExecutionReceipt 由 NodeAttemptReceipt 替代 | ADR-109 |
| A-16 | ADR-027 | Principal 集合以 user/service/agent/worker/plugin/system 为准 | ADR-109 |
| A-17 | ADR-027 | SANDBOX_NONE 不再作为 default-deny 新实现入口 | ADR-109 |
| A-18 | ADR-026 | 风险因子以 architecture risk model 和 RiskRegister 为准 | ADR-112 |
| A-19 | ADR-025 | PolicyMode 以 architecture runtime mode / degradation mode 为准 | ADR-112 |
| A-20 | ADR-073 | canonical resource 为 HarnessRun / NodeRun / PlanGraphBundle | ADR-109 |
| A-21 | ADR-004 | v3 代理层次由五平面 + HarnessRuntime 取代 | ADR-112 |
| A-22 | ADR-005 | runtime mode 与 autonomy mode 不再混用 | ADR-112 |
| A-23 | ADR-064 | cost dimensions 使用 harnessRunId / nodeRunId / BudgetSettlement lineage | ADR-109 |
| A-24 | ADR-052 | 多主 truth 写入不作为 v4.3 承诺；跨区写入由 truth leader gate 管理 | ADR-112 |
| A-25 | ADR-058 | emergency stop 使用 PlatformPanicDirective / OperationalDirective(type=kill) | ADR-109 / ADR-112 |
| A-26 | ADR-098 | HITL 等待态使用 canonical `awaiting_hitl` | ADR-110 |
| A-27 | ADR-066-plugin | DomainPlannerPlugin 输出必须适配 PlanGraphBundle | ADR-109 |
| A-28 | ADR-040 | Goal lifecycle 不定义 HarnessRun authority | ADR-110 / ADR-112 |
| A-29 | ADR-073 | Phase 1-4 仅作历史映射，当前使用 Ring 1/2/3 | ADR-112 |
| A-30 | ADR-094 | phase 8b 仅作历史语境，当前使用 Ring / release gate | ADR-112 |
| A-31 | ADR-099 | phase 8c 仅作历史语境，当前使用 Ring / release gate | ADR-112 |
| A-32 | ADR-037 | DomainClass 历史分类由 24 domain spec 覆盖 | ADR-112 |
| A-33 | ADR-092 | timeline 中 step/decision 仅为投影，truth 绑定 NodeRun / NodeAttempt | ADR-111 |
| A-34 | ADR-042 | full_auto 高危域必须受 DomainRiskSpec 与 human accountability gate 约束 | ADR-112 |
| A-35 | ADR-075 | shadow / rollout 历史级别名不再定义 canonical release level | ADR-112 |
| A-36 | ADR-066-plugin | 不可信插件隔离以独立进程 + IPC 边界为准 | ADR-109 |
| A-37 | ADR-093 | ConstraintPack 必须包含 budget envelope / sandbox / approval requirement | ADR-109 / ADR-110 |

## 后果

- 审计报告中的 A-1 至 A-37 可标记为已完成，证据链为 `ImplementationConsistencyClosureRegistry`、本 ADR、ADR-109 至 ADR-112。
- 历史 ADR 正文保留，便于追踪当时决策背景；新实现不得以历史 ADR 中被本 ADR supersede 的字段、状态、命名或执行入口作为 canonical authority。
- `tests/invariants/implementation-consistency-closure.test.ts` 必须校验 ADR 收口证据文件真实存在。

## 关联文档

- [00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [platform-architecture-implementation-consistency-audit.md](../reviews/platform-architecture-implementation-consistency-audit.md)
- [109-contract-freeze.md](./109-contract-freeze.md)
- [110-runtime-state-machine-authority.md](./110-runtime-state-machine-authority.md)
- [111-platform-fact-vs-oapeflir-view-events.md](./111-platform-fact-vs-oapeflir-view-events.md)
- [112-mvp-ring-implementation-boundary.md](./112-mvp-ring-implementation-boundary.md)
