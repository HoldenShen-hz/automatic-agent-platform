# 旧系统到新平台的迁移边界

## 来源

本边界以以下文档为准：

- [../architecture/00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [00-migration-guideline.md](./00-migration-guideline.md)

规则：

- 平台骨架文档定义目标态
- 迁移指南定义迁移顺序和分级
- 当前代码架构文档作为存量资产与重构成本参考

## 必须迁移的工程资产

当前实现结构（Phase 1a-4）已覆盖以下工程资产：

- `src/platform/five-plane-control-plane/` — IAM, 配置中心, 审批中心, 事件控制
- `src/platform/five-plane-execution/` — 调度器, 执行引擎, 恢复, Worker池
- `src/platform/five-plane-orchestration/` — OAPEFLIR, 路由, planner, HITL
- `src/platform/five-plane-state-evidence/` — Truth, Events, Checkpoints, Artifacts, Knowledge, Memory
- `src/platform/five-plane-interface/` — API, Channel Gateway, Ingress, Scheduler
- `src/platform/shared/` — 可观测性, 稳定性, 工具元数据
- `src/platform/model-gateway/` — 模型网关, 成本追踪
- `src/platform/prompt-engine/` — Prompt引擎
- `src/interaction/` — NL入口, 目标分解, 主动Agent, 仪表盘, UX
- `src/org-governance/` — 组织层级, SSO/SCIM, 合规
- `src/ops-maturity/` — 可解释性, 漂移检测, 边缘计算, 成本, 混沌工程
- `src/scale-ecosystem/` — 多区域, 公平调度, SLA, 连接器, 市场
- `src/sdk/` — CLI, Pack SDK, Plugin SDK, Client SDK
- `src/domains/` — 领域描述符, 接入, 注册表
- `src/plugins/` — 插件系统
- `src/testing/` — 测试工具
- `src/benchmarks/` — 性能基准测试
- `config/`
- `divisions/`
- `deploy/`
- `scripts/`
- `tests/unit`
- `tests/integration`
- `tests/golden`

## 必须补上的新平台能力

当前已实现：

- `src/interaction/nl-gateway/` — NL入口
- `src/interaction/proactive-agent/` — 主动Agent
- `src/ops-maturity/drift-detection/` — 漂移检测

## 需要改造后迁移的文档族

以下内容仍有价值，但不能原样复制：

- 旧 `doc/00` 到 `doc/07`
- `18_code_architecture.md`
- `19_full_coverage_test_manual.md`
- `runtime-sequence.md`
- `module-inventory.md`
- `release-checklist.md`
- 旧 `docs_zh/contracts/`
- 旧 `docs_zh/adr/`
- 旧 `docs_zh/guides/`
- 旧 `docs_zh/governance/`

改造规则：

- 全部改写成新平台五平面架构和当前目录结构
- 停止把 `reviews/` 和 `archive/` 当作活跃事实源
- 正式文档统一落到 `docs_zh/` 与 `docs_en/`

## 只保留参考价值的材料

以下内容可留在旧仓库查阅，但不进入新平台正式文档集：

- 旧 `docs_zh/reference/`
- 旧 `docs_zh/research/`
- 旧 `system-status-matrix.md`
- 竞品分析、reference alignment 研究
- 一次性 gap analysis 与专项审查

## 明确不迁移的内容

以下内容不进入新平台正式文档集：

- 旧 `docs_zh/reviews/`
- 旧 `docs_zh/archive/`
- 旧 `docs_zh/operations/archive/`
- 历史 TODO、阶段快照、签收记录、一次性评估材料

## 结论

迁移已完成。当前 `src/platform/` 是权威代码目录，包含所有核心运行时逻辑。`src/core/` 仅用于向后兼容。

当前文档体系：

- `docs_zh/architecture/` — 5 个架构文档
- `docs_zh/contracts/` — 113 个契约文档
- `docs_zh/adr/` — 38 个 ADR 文档
- `docs_zh/operations/` — 16 个运维文档
- `docs_zh/reviews/` — 架构与实现差异评审
