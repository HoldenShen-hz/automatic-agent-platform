# Phase Docs

> 本目录按阶段维护平台推进文档。
> 每个阶段文档都应说明目标、进入条件、范围、非目标、交付物、依赖、验证指标、退出门槛和交接边界。
> 阶段级”验收与退出门槛”应与 [operations-checklist.md](../operations-checklist.md) 保持一致。

## 当前阶段文档

- [phase-1a-foundation.md](./phase-1a-foundation.md)
- [phase-1b-orchestration.md](./phase-1b-orchestration.md)
- [phase-2a-multi-division.md](./phase-2a-multi-division.md)
- [phase-2b-memory-governance-stability.md](./phase-2b-memory-governance-stability.md)
- [phase-2c-skills-hr-evolution.md](./phase-2c-skills-hr-evolution.md)
- [phase-3-pmf-commercialization.md](./phase-3-pmf-commercialization.md)
- [phase-4-enterprise-ecosystem.md](./phase-4-enterprise-ecosystem.md)

## 统一模板

每个阶段文档至少应包含以下部分：

1. 目标
2. 进入条件
3. 必做范围
4. 非目标
5. 关键 contract / 主文档
6. 核心交付物
7. 验收与退出门槛
8. 风险与控制点
9. 向下一阶段交接

## 阶段关系

```mermaid
flowchart LR
    A["Phase 1a"] --> B["Phase 1b"]
    B --> C["Phase 2a"]
    C --> D["Phase 2b"]
    D --> E["Phase 2c"]
    E --> F["Phase 3"]
    F --> G["Phase 4"]
```

## 使用规则

- 当前仓库实现已覆盖 `Phase 1a ~ Phase 4` 的既定工作包；阶段文档在此处主要承担边界、非目标和验收口径说明。
- `Phase` 文档描述的是当前路线图内的 authoritative 阶段边界，不等同于 `M2` 目标态扩展项。
- 若某阶段边界变化，先更新对应 phase 文档，再更新 `05_delivery_scope_and_milestones.md` 与 `phase_readiness_matrix.md`。
- 若当前阶段目标包含”可稳定运行”，还必须遵守 `gap-analysis.md` 与 `gap-analysis.md`。
