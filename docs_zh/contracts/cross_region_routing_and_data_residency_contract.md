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

