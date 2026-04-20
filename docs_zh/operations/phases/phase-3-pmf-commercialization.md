# Phase 3 PMF Commercialization

## 1. 目标

在前两阶段平台稳定的基础上，验证 PMF、建立收费能力，并开始引入 Observe-compatible 主动模式能力。

## 2. 进入条件

- 2a / 2b / 2c 的平台主链、治理和演化边界已基本稳定
- skill、billing、tenant、observe-compatible product slice 已有上位 contract
- 可观测、计量和产品指标链可用
- 进入 3 前已重新通过 `operations-checklist.md` 的当前阶段签收

## 3. 必做范围

- Pro 收费能力与套餐边界。
- Observe-compatible 模块第一版。
- 更完整的 Web / API 使用体验。
- 运营指标、留存、转化与成本看板。
- 支持更丰富的交互与 workspace 体验。

## 4. 非目标

- 完整企业生态与 marketplace 全面开放。
- 大规模组织治理全部一次到位。

## 5. 关键 contract / 主文档

- [billing_and_tenant_contract.md](../../contracts/billing_and_tenant_contract.md)
- [monetization_metering_plane_contract.md](../../contracts/monetization_metering_plane_contract.md)
- [perception_contract.md](../../contracts/perception_contract.md)
- [perception_intelligence_plane_contract.md](../../contracts/perception_intelligence_plane_contract.md)
- [license_and_capability_boundary_contract.md](../../contracts/license_and_capability_boundary_contract.md)
- [hitl_experience_and_explainability_contract.md](../../contracts/hitl_experience_and_explainability_contract.md)
- [operations-checklist.md](../operations-checklist.md)

## 6. 核心交付物

- 收费计划与权限边界。
- Observe-compatible 模块 MVP。
- PMF 指标追踪体系。
- Phase 3 商业化验收文档。

## 7. 验收与退出门槛

- 收费用户获得稳定价值。
- 单位经济模型开始成立。
- Observe-compatible 模块不会破坏主任务链稳定性。
- 当前阶段涉及模块已满足 `operations-checklist.md` 中对应的“当前阶段可验收”标准。

## 8. 风险与控制点

- 风险：收费能力与 runtime/entitlement 没有真正闭合。
- 控制：套餐、计量、quota、policy 必须同源治理。
- 风险：Observe-compatible 模块直接污染主任务链。
- 控制：Observe 默认只提议，不直接改任务真相。

## 9. 向下一阶段交接

- Phase 4 接手的是企业级组织治理、生态和规模化运维，不应在 Phase 3 内把 enterprise 全量复杂度一次引入。
