# 旧系统到新平台的迁移边界

## 来源

本边界以以下文档为准：

- [../architecture/00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [00-migration-guideline.md](./00-migration-guideline.md)
- 旧系统 `automatic_agent_system/doc/18_code_architecture.md`

规则：

- 平台骨架文档定义目标态
- 迁移指南定义迁移顺序和分级
- 旧代码架构文档只作为存量资产与重构成本参考

## 必须迁移的工程资产

迁移基线必须覆盖以下工程资产：

- `src/core/types`
- `src/core/errors.ts`
- `src/core/config`
- `src/core/storage`
- `src/core/events`
- `src/core/cache`
- `src/core/locking`
- `src/core/queue`
- `src/core/runtime`
- `src/core/tools`
- `src/core/providers`
- `src/core/workflow`
- `src/core/approvals`
- `src/core/security`
- `src/core/observability`
- `src/core/stability`
- `src/core/ops`
- `src/core/api`
- `src/core/artifacts`
- `src/core/orchestration`
- `src/core/agent-loop`
- `src/core/planning`
- `src/core/feedback`
- `src/core/learning`
- `src/core/improvement`
- `src/core/domain-registry`
- `src/core/knowledge`
- `src/core/memory`
- `src/core/messages`
- `src/core/reliability`
- `src/core/resource`
- `src/core/results`
- `src/cli`
- `src/gateway`
- `src/plugins`
- `config/`
- `divisions/`
- `deploy/`
- `scripts/`
- `tests/unit`
- `tests/integration`
- `tests/contracts`
- `tests/reliability`
- `tests/performance`

这些不是“把旧设计照抄过来”，而是旧系统里仍可复用、能构成新平台基线的工程资产。

## 必须补上的新平台能力

即使旧系统中实现不完整，新平台也必须显式具备：

- `src/core/nl-entry`
- `src/core/goal-decomposition`
- `src/core/proactive-agent`
- `src/core/autonomy`
- `src/core/dashboard`
- `src/gateway/user-portal`

## 需要改造后迁移的文档族

以下内容仍有价值，但不能原样复制：

- 旧 `doc/00` 到 `doc/07`
- `18_code_architecture.md`
- `19_full_coverage_test_manual.md`
- `runtime-sequence.md`
- `module-inventory.md`
- `release-checklist.md`
- 旧 `doc/contracts/`
- 旧 `doc/adr/`
- 旧 `doc/guides/`
- 旧 `doc/governance/`

改造规则：

- 全部改写成新平台七层模型和当前目录结构
- 停止把 `reviews/` 和 `archive/` 当作活跃事实源
- 正式文档统一落到 `docs_zh/` 与 `docs_en/`

## 只保留参考价值的材料

以下内容可留在旧仓库查阅，但不进入新平台正式文档集：

- 旧 `doc/reference/`
- 旧 `doc/research/`
- 旧 `system-status-matrix.md`
- 竞品分析、reference alignment 研究
- 一次性 gap analysis 与专项审查

## 明确不迁移的内容

以下内容不进入新平台正式文档集：

- 旧 `doc/reviews/`
- 旧 `doc/archive/`
- 旧 `doc/operations/archive/`
- 历史 TODO、阶段快照、签收记录、一次性评估材料

## 结论

这次迁移不是“把旧项目整体复制到新目录”。

而是：

1. 迁移可复用的代码、配置、测试与工程资产
2. 补齐新架构要求的平台专属模块
3. 只迁移仍有效的规范性文档
4. 排除历史 review、archive 与一次性分析材料
