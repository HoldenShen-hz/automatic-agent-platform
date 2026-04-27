# Cross Region Routing And Data Residency Contract

## 1. 范围

本 contract 定义 `§52` 的 Region 模型、跨 Region 路由与数据驻留约束。

## 2. Canonical 对象

- `RegionDescriptor`
- `ResidencyPolicy`
- `CrossRegionRouteRequest`
- `CrossRegionRouteDecision`
- `ReplicationPolicy`

## 3. `RegionDescriptor` 最小字段

- `region_id`
- `country_code`
- `jurisdiction`
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

- 数据驻留优先于延迟最优。
- 跨境传输必须有显式 policy 与审计记录。
- 不满足驻留要求的 region 必须排除在候选集合之外。

## 6. 测试要求

- unit：region matching、residency checks、candidate scoring
- integration：跨 region 路由和 failover 决策
- contract：驻留违规请求不得被调度到非法 region



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-42: RegionDescriptor缺provider/endpoints/dataResidencyPolicy(§52.1)；缺写边界规则CAS/Lease/Fencing(§52.3)。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
