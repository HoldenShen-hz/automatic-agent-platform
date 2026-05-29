# Cross Region Routing And Data Residency Contract

## 1. 范围

本 contract defines `§52` 的 Region 模型、跨 Region 路由vsdata驻留约束。

## 2. Canonical 对象

- `RegionDescriptor`
- `ResidencyPolicy`
- `CrossRegionRouteRequest`
- `CrossRegionRouteDecision`
- `ReplicationPolicy`

## 3. `RegionDescriptor` 最小字段

- `region_id`
- `provider`
- `control_plane_endpoint`
- `data_plane_endpoint`
- `country_code`
- `jurisdiction`
- `data_residency_policy`
- `capabilities`
- `status`

## 4. `CrossRegionRouteDecision` 最小字段

- `selected_region_id`
- `candidate_regions`
- `residency_decision`
- `latency_score`
- `recovery_topology`
- `blocked_regions`

## 5. 规则

- data驻留优先于delay最优。
- 跨境传输必须有显式 policy vs审计record。
- 不满足驻留要求的 region 必须排除在候选集合之外。
- cross-region route decision 只能决定读路由、worker 选址和灾备切换，不得bypassing truth 写边界。
- `HarnessRun / NodeRun / BudgetLedger` 的 truth writes必须坚持单 writer 语义；跨 region 接管前必须完成 CAS 校验、lease 转移和 fencing token 轮换。
- 同一 `harness_run_id / node_run_id` 在任意时刻只能有一个可提交 truth mutation 的 active region owner。
- 若 region 故障触发接管，新的 writer region 必须先确认旧 lease 失效或被显式回收，再继续 `RuntimeStateMachine.transition(command)`。

## 6. 测试要求

- unit：region matching、residency checks、candidate scoring
- integration：跨 region 路由和 failover Decision
- contract：驻留违规request不得被调度到非法 region



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-42: 本文原先把 cross-region contract 写成纯候选 region 打分模型，Root cause: 文案只覆盖了路由/驻留选择，没有把多 region 下的 truth 写边界vs接管语义纳入 contract。修复：正文现为 `RegionDescriptor` 补齐 `provider / control_plane_endpoint / data_plane_endpoint / data_residency_policy`，并明确跨 region 接管必须遵守 CAS、lease 转移和 fencing token 轮换。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
